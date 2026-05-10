import type { PrismaClient } from '@prisma/client';
import { kstMonthRangeYm } from '../inquiries/inquiryListDateRange.js';
import {
  crewMemberNoteIncludesTeamMember,
  payYmdInMonth,
  payrollAccrualPeriodForPaymentDate,
  payrollCyclePreferredDateWhere,
} from '../teams/teamMemberPayrollCycle.js';
import { dateToYmdKst } from '../users/userEmployment.js';
import { sumCrewExpensesByMemberIdsForMonth } from '../crew/crewGroupExpense.service.js';
import { sumLedgerManualPoolMemberDeductionsByMonth } from './payrollLedgerManualPayrollDeductions.js';

export type PoolPayrollSheetRowOut = {
  kind: 'POOL_MEMBER';
  id: string;
  name: string;
  roleLabel: string;
  /** 팀원 등록의 월 급여 지급일(1~31). 미설정·범위 밖이면 null */
  monthlyPayDay: number | null;
  payDateYmd: string | null;
  accrualStartYmd: string | null;
  accrualEndYmd: string | null;
  jobCount: number | null;
  unitAmount: number | null;
  amount: number | null;
  notes: string[];
  poolSystemDays?: number | null;
  poolManualExtraDays?: number | null;
  poolSettlementComplete?: boolean;
  /** 귀속 월 정산 완료 시 확정 지급액(실지급 기준 스냅샷). 미정산이면 null */
  poolSettledAmount?: number | null;
  crewExpenseTotal?: number;
  /** 해당 귀속 월 수기 장부 지출 중 이 팀원(풀)에 연결된 합계 — 실지급 예상에서 차감 */
  poolLedgerManualDeductionTotal?: number;
  amountNet?: number | null;
};

/**
 * 관리자 월 급여표 · 크루 정산표 공통 — 풀(`teamId: null`) 팀원 행만 계산한다.
 */
export async function buildPoolMemberPayrollSheetRows(
  prismaClient: PrismaClient,
  monthKey: string,
  poolMembers: {
    id: string;
    name: string;
    nameTh: string | null;
    monthlyPayDay: number | null;
    payAmountPerJob: number | null;
    sortOrder: number;
    createdAt: Date;
  }[],
): Promise<PoolPayrollSheetRowOut[]> {
  const range = kstMonthRangeYm(monthKey);
  if (!range) return [];

  const [yStr, mStr] = monthKey.split('-');
  const calYear = parseInt(yStr, 10);
  const calMonthNum = parseInt(mStr, 10);
  const monthIndex = calMonthNum - 1;

  const byPayDay = new Map<number, (typeof poolMembers)[number][]>();
  for (const m of poolMembers) {
    const d = m.monthlyPayDay;
    if (d == null || d < 1 || d > 31) continue;
    if (!byPayDay.has(d)) byPayDay.set(d, []);
    byPayDay.get(d)!.push(m);
  }

  const payrollDaysByMemberId = new Map<string, Set<string>>();
  for (const pm of poolMembers) {
    payrollDaysByMemberId.set(pm.id, new Set());
  }

  const periodByPayDay = new Map<number, { startYmd: string; endYmd: string }>();
  let envelopeMin: string | null = null;
  let envelopeMax: string | null = null;
  for (const payDay of byPayDay.keys()) {
    const payDateYmd = payYmdInMonth(calYear, monthIndex, payDay);
    const period = payrollAccrualPeriodForPaymentDate(payDateYmd, payDay);
    if (!period) continue;
    periodByPayDay.set(payDay, period);
    if (envelopeMin == null || period.startYmd < envelopeMin) envelopeMin = period.startYmd;
    if (envelopeMax == null || period.endYmd > envelopeMax) envelopeMax = period.endYmd;
  }

  const PAYROLL_INQUIRY_BATCH = 2000;
  if (periodByPayDay.size > 0 && envelopeMin != null && envelopeMax != null) {
    const envBounds = payrollCyclePreferredDateWhere(envelopeMin, envelopeMax);
    let cursorId: string | undefined;
    for (;;) {
      const batch = await prismaClient.inquiry.findMany({
        where: {
          preferredDate: { gte: envBounds.gte, lte: envBounds.lte },
          status: { notIn: ['CANCELLED', 'ON_HOLD'] },
        },
        select: { id: true, crewMemberNote: true, preferredDate: true },
        orderBy: { id: 'asc' },
        take: PAYROLL_INQUIRY_BATCH,
        ...(cursorId ? { skip: 1, cursor: { id: cursorId } } : {}),
      });
      if (batch.length === 0) break;

      for (const inq of batch) {
        if (!inq.preferredDate) continue;
        const ymd = dateToYmdKst(inq.preferredDate);
        for (const [payDay, period] of periodByPayDay) {
          if (ymd < period.startYmd || ymd > period.endYmd) continue;
          const members = byPayDay.get(payDay);
          if (!members?.length) continue;
          for (const mem of members) {
            if (!crewMemberNoteIncludesTeamMember(inq.crewMemberNote, mem)) continue;
            payrollDaysByMemberId.get(mem.id)?.add(ymd);
          }
        }
      }

      cursorId = batch[batch.length - 1]!.id;
    }
  }

  const ids = poolMembers.map((pm) => pm.id);
  const poolAdjusts =
    ids.length === 0
      ? []
      : await prismaClient.teamMemberPayrollMonthAdjust.findMany({
          where: { monthKey, teamMemberId: { in: ids } },
        });
  const extraDaysByMemberId = new Map(poolAdjusts.map((a) => [a.teamMemberId, a.extraWorkDays]));

  const crewExpenseByPoolMemberId =
    ids.length === 0 ? new Map<string, number>() : await sumCrewExpensesByMemberIdsForMonth(ids, monthKey);

  const ledgerManualDedByPoolMemberId =
    ids.length === 0
      ? new Map<string, number>()
      : await sumLedgerManualPoolMemberDeductionsByMonth(prismaClient, monthKey, ids);

  const poolSettlementRows =
    ids.length === 0
      ? []
      : await prismaClient.teamMemberPayrollSettlement.findMany({
          where: { monthKey, teamMemberId: { in: ids } },
          select: { teamMemberId: true, amount: true },
        });
  const settledAmountByMemberId = new Map(poolSettlementRows.map((row) => [row.teamMemberId, row.amount]));

  const rows: PoolPayrollSheetRowOut[] = [];
  for (const m of poolMembers) {
    const notes: string[] = [];
    let payDateYmd: string | null = null;
    let accrualStartYmd: string | null = null;
    let accrualEndYmd: string | null = null;
    let autoDays: number | null = null;
    let unitAmount: number | null = m.payAmountPerJob;
    let amount: number | null = null;

    const manualExtraRaw = extraDaysByMemberId.get(m.id) ?? 0;
    const manualExtra =
      typeof manualExtraRaw === 'number' &&
      Number.isFinite(manualExtraRaw) &&
      manualExtraRaw > 0
        ? Math.min(93, Math.floor(manualExtraRaw))
        : 0;

    if (m.monthlyPayDay != null && m.monthlyPayDay >= 1 && m.monthlyPayDay <= 31) {
      payDateYmd = payYmdInMonth(calYear, monthIndex, m.monthlyPayDay);
      const period = payrollAccrualPeriodForPaymentDate(payDateYmd, m.monthlyPayDay);
      if (period) {
        accrualStartYmd = period.startYmd;
        accrualEndYmd = period.endYmd;
        if (periodByPayDay.has(m.monthlyPayDay)) {
          autoDays = payrollDaysByMemberId.get(m.id)?.size ?? 0;
        }
      }
    } else {
      notes.push('월급 지급일 미설정');
    }

    if (m.payAmountPerJob == null) {
      notes.push('일당(1일 급여) 미설정');
      unitAmount = null;
    }

    let jobCount: number | null = null;
    if (autoDays !== null) {
      jobCount = autoDays + manualExtra;
    } else if (manualExtra > 0) {
      jobCount = manualExtra;
      notes.push('자동 근무일 산정 없음·수기 일만 반영');
    }
    if (manualExtra > 0) {
      notes.push(`수기 추가 근무 ${manualExtra}일`);
    }

    if (jobCount != null && unitAmount != null) {
      amount = jobCount * unitAmount;
    }

    const crewExpenseTotal = crewExpenseByPoolMemberId.get(m.id) ?? 0;
    const poolLedgerManualDeductionTotal = ledgerManualDedByPoolMemberId.get(m.id) ?? 0;
    const amountNet =
      amount != null
        ? Math.max(0, amount - crewExpenseTotal - poolLedgerManualDeductionTotal)
        : null;

    const dedParts: string[] = [];
    if (crewExpenseTotal > 0) {
      dedParts.push(`크루 등록 지출 ${crewExpenseTotal.toLocaleString('ko-KR')}원`);
    }
    if (poolLedgerManualDeductionTotal > 0) {
      dedParts.push(`수기 장부 연결 선차감 ${poolLedgerManualDeductionTotal.toLocaleString('ko-KR')}원`);
    }
    if (dedParts.length > 0 && amount != null && amountNet != null) {
      notes.push(`${dedParts.join(', ')} 차감 → 실지급 예상 ${amountNet.toLocaleString('ko-KR')}원`);
    }

    rows.push({
      kind: 'POOL_MEMBER',
      id: m.id,
      name: m.name,
      roleLabel: '현장',
      monthlyPayDay:
        m.monthlyPayDay != null && m.monthlyPayDay >= 1 && m.monthlyPayDay <= 31 ? m.monthlyPayDay : null,
      payDateYmd,
      accrualStartYmd,
      accrualEndYmd,
      jobCount,
      unitAmount,
      amount,
      notes,
      poolSystemDays: autoDays,
      poolManualExtraDays: manualExtra,
      poolSettlementComplete: settledAmountByMemberId.has(m.id),
      poolSettledAmount: settledAmountByMemberId.get(m.id) ?? null,
      crewExpenseTotal,
      poolLedgerManualDeductionTotal,
      amountNet,
    });
  }

  return rows;
}
