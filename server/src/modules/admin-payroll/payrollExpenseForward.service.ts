import type { PrismaClient } from '@prisma/client';
import {
  payrollCycleBoundsKst,
  payrollCyclePreferredDateWhere,
  crewMemberNoteIncludesTeamMember,
} from '../teams/teamMemberPayrollCycle.js';
import { dateToYmdKst, employmentOverlapsMonthKst } from '../users/userEmployment.js';
import { sumCrewExpensesByMemberIdsForMonth } from '../crew/crewGroupExpense.service.js';
import { sumLedgerManualPoolMemberDeductionsByMonth } from './payrollLedgerManualPayrollDeductions.js';
import { tenantActiveTeamMemberWhere } from '../inquiries/crewMemberCapacity.helpers.js';

const PAYROLL_INQUIRY_BATCH = 2000;

function inclusiveCalendarDays(startYmd: string, endYmd: string): number {
  const s = new Date(`${startYmd}T12:00:00+09:00`).getTime();
  const e = new Date(`${endYmd}T12:00:00+09:00`).getTime();
  if (!Number.isFinite(s) || !Number.isFinite(e) || e < s) return 0;
  return Math.floor((e - s) / 86400000) + 1;
}

/** 귀속 종료일 다음 날 = 급여 지급일 → 귀속 월(monthKey) 산출용 */
function payMonthKeyAfterAccrualEnd(accrualEndYmd: string): string {
  const payMs = new Date(`${accrualEndYmd}T12:00:00+09:00`).getTime() + 86400000;
  return dateToYmdKst(new Date(payMs)).slice(0, 7);
}

/** 급여 귀속 구간(양 끝 포함)에 대해 등록 월급 일할 누적 — 미정산현황·급여표 수입·지출 탭과 동일 규칙 */
export type MarketerAccruedEstimateInput = {
  accrualStartYmd: string;
  accrualEndYmd: string;
  salary: number | null | undefined;
  todayYmd: string;
};

export type MarketerAccruedEstimateBreakdown = {
  payMonthKey: string;
  partialEndYmd: string;
  cycleDaysTotal: number;
  elapsedDays: number;
  /** 귀속 구간 일수(inclusive)를 분모로 사용 — 주기 종료 시 일할 합이 등록 월급과 일치 */
  rateBasis: 'cycle_days';
  denominatorDays: number | null;
  accruedEstimate: number | null;
};

export function computeMarketerAccruedEstimateForAccrualBounds(
  input: MarketerAccruedEstimateInput,
): MarketerAccruedEstimateBreakdown | null {
  const { accrualStartYmd, accrualEndYmd, salary, todayYmd } = input;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(accrualStartYmd.trim()) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(accrualEndYmd.trim())
  ) {
    return null;
  }

  const cycleDaysTotal = inclusiveCalendarDays(accrualStartYmd, accrualEndYmd);
  if (cycleDaysTotal <= 0) return null;

  const partialEndYmd = accrualEndYmd < todayYmd ? accrualEndYmd : todayYmd;
  const elapsedDays =
    partialEndYmd < accrualStartYmd ? 0 : inclusiveCalendarDays(accrualStartYmd, partialEndYmd);

  const payMonthKey = payMonthKeyAfterAccrualEnd(accrualEndYmd);
  const denominatorDays = cycleDaysTotal > 0 ? cycleDaysTotal : null;

  let accruedEstimate: number | null = null;
  const sal = salary;
  if (
    sal != null &&
    Number.isFinite(sal) &&
    sal > 0 &&
    denominatorDays != null &&
    denominatorDays > 0 &&
    elapsedDays > 0
  ) {
    accruedEstimate = Math.round((sal * elapsedDays) / denominatorDays);
  }

  return {
    payMonthKey,
    partialEndYmd,
    cycleDaysTotal,
    elapsedDays,
    rateBasis: 'cycle_days',
    denominatorDays,
    accruedEstimate,
  };
}

export type PayrollExpenseForwardPoolRow = {
  teamMemberId: string;
  name: string;
  monthlyPayDay: number;
  cycleStartYmd: string;
  cycleEndYmd: string;
  partialEndYmd: string;
  payMonthKey: string;
  autoJobDays: number;
  manualExtraDays: number;
  jobDays: number | null;
  unitAmount: number | null;
  partialGross: number | null;
  crewExpenseTotal: number;
  /** 귀속 월 수기 장부에서 이 팀원에 연결된 지출 합계 */
  poolLedgerManualDeductionTotal: number;
  partialNet: number | null;
  poolSettlementComplete: boolean;
  notes: string[];
};

export type PayrollExpenseForwardMarketerRow = {
  userId: string;
  name: string;
  payrollPayDay: number;
  cycleStartYmd: string;
  cycleEndYmd: string;
  partialEndYmd: string;
  payMonthKey: string;
  monthlySalary: number | null;
  settlementComplete: boolean;
  rateBasis: 'cycle_days';
  denominatorDays: number | null;
  elapsedDays: number;
  cycleDaysTotal: number;
  accruedEstimate: number | null;
};

export type PayrollExpenseForwardPayload = {
  todayYmd: string;
  pool: PayrollExpenseForwardPoolRow[];
  marketers: PayrollExpenseForwardMarketerRow[];
  totals: {
    poolPartialGross: number;
    poolPartialNet: number;
    marketerAccrued: number;
  };
};

export async function computePayrollExpenseForward(
  prismaClient: PrismaClient,
  tenantId: string,
): Promise<PayrollExpenseForwardPayload> {
  const todayYmd = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);

  const poolMembers = await prismaClient.teamMember.findMany({
    where: {
      teamId: null,
      ...tenantActiveTeamMemberWhere(tenantId),
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true,
      name: true,
      nameTh: true,
      monthlyPayDay: true,
      payAmountPerJob: true,
    },
  });

  const byPayDay = new Map<number, typeof poolMembers>();
  for (const m of poolMembers) {
    const d = m.monthlyPayDay;
    if (d == null || d < 1 || d > 31) continue;
    if (!byPayDay.has(d)) byPayDay.set(d, []);
    byPayDay.get(d)!.push(m);
  }

  const poolOut: PayrollExpenseForwardPoolRow[] = [];

  type PayDayPoolCtx = {
    payDay: number;
    members: typeof poolMembers;
    bounds: ReturnType<typeof payrollCycleBoundsKst>;
    partialEndYmd: string;
    payMonthKey: string;
    payrollDaysByMemberId: Map<string, Set<string>>;
  };

  const poolCtxByPayDay = new Map<number, PayDayPoolCtx>();

  for (const payDay of [...byPayDay.keys()].sort((a, b) => a - b)) {
    const members = byPayDay.get(payDay)!;
    const bounds = payrollCycleBoundsKst(payDay);
    const partialEndYmd = bounds.endYmd < todayYmd ? bounds.endYmd : todayYmd;
    const payMonthKey = payMonthKeyAfterAccrualEnd(bounds.endYmd);
    const payrollDaysByMemberId = new Map<string, Set<string>>();
    for (const m of members) {
      payrollDaysByMemberId.set(m.id, new Set());
    }
    poolCtxByPayDay.set(payDay, {
      payDay,
      members,
      bounds,
      partialEndYmd,
      payMonthKey,
      payrollDaysByMemberId,
    });
  }

  /** payDay별 inquiry 반복 스캔 → 전체 envelope 1회 스캔 후 payDay·팀원별 분배 */
  let envelopeGte: Date | null = null;
  let envelopeLte: Date | null = null;
  for (const ctx of poolCtxByPayDay.values()) {
    if (ctx.partialEndYmd < ctx.bounds.startYmd) continue;
    const env = payrollCyclePreferredDateWhere(ctx.bounds.startYmd, ctx.partialEndYmd);
    if (envelopeGte == null || env.gte < envelopeGte) envelopeGte = env.gte;
    if (envelopeLte == null || env.lte > envelopeLte) envelopeLte = env.lte;
  }

  if (envelopeGte != null && envelopeLte != null) {
    let cursorId: string | undefined;
    for (;;) {
      const batch = await prismaClient.inquiry.findMany({
        where: {
          tenantId,
          preferredDate: { gte: envelopeGte, lte: envelopeLte },
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
        for (const ctx of poolCtxByPayDay.values()) {
          if (ctx.partialEndYmd < ctx.bounds.startYmd) continue;
          if (ymd < ctx.bounds.startYmd || ymd > ctx.partialEndYmd) continue;
          for (const mem of ctx.members) {
            if (!crewMemberNoteIncludesTeamMember(inq.crewMemberNote, mem)) continue;
            ctx.payrollDaysByMemberId.get(mem.id)?.add(ymd);
          }
        }
      }
      cursorId = batch[batch.length - 1]!.id;
    }
  }

  for (const payDay of [...poolCtxByPayDay.keys()].sort((a, b) => a - b)) {
    const ctx = poolCtxByPayDay.get(payDay)!;
    const { members, bounds, partialEndYmd, payMonthKey, payrollDaysByMemberId } = ctx;

    if (partialEndYmd < bounds.startYmd) {
      for (const m of members) {
        const notes: string[] = ['오늘이 이번 급여 산정 시작일 이전입니다.'];
        poolOut.push({
          teamMemberId: m.id,
          name: m.name,
          monthlyPayDay: payDay,
          cycleStartYmd: bounds.startYmd,
          cycleEndYmd: bounds.endYmd,
          partialEndYmd,
          payMonthKey,
          autoJobDays: 0,
          manualExtraDays: 0,
          jobDays: null,
          unitAmount: m.payAmountPerJob,
          partialGross: null,
          crewExpenseTotal: 0,
          poolLedgerManualDeductionTotal: 0,
          partialNet: null,
          poolSettlementComplete: false,
          notes,
        });
      }
      continue;
    }

    const ids = members.map((x) => x.id);
    const [adjusts, settleRows, crewExpMap, ledgerDedMap] = await Promise.all([
      ids.length === 0
        ? []
        : prismaClient.teamMemberPayrollMonthAdjust.findMany({
            where: { monthKey: payMonthKey, teamMemberId: { in: ids } },
          }),
      ids.length === 0
        ? []
        : prismaClient.teamMemberPayrollSettlement.findMany({
            where: { monthKey: payMonthKey, teamMemberId: { in: ids } },
            select: { teamMemberId: true },
          }),
      ids.length === 0 ? new Map<string, number>() : sumCrewExpensesByMemberIdsForMonth(ids, payMonthKey),
      ids.length === 0
        ? new Map<string, number>()
        : sumLedgerManualPoolMemberDeductionsByMonth(prismaClient, payMonthKey, ids),
    ]);
    const extraById = new Map(adjusts.map((a) => [a.teamMemberId, a.extraWorkDays]));
    const settledIds = new Set(settleRows.map((r) => r.teamMemberId));

    for (const m of members) {
      const notes: string[] = [];
      const auto = payrollDaysByMemberId.get(m.id)?.size ?? 0;
      const manualRaw = extraById.get(m.id) ?? 0;
      const manualExtra =
        typeof manualRaw === 'number' && Number.isFinite(manualRaw) && manualRaw > 0
          ? Math.min(93, Math.floor(manualRaw))
          : 0;
      let jobCount: number | null = null;
      const unitAmount = m.payAmountPerJob;
      if (unitAmount == null) {
        notes.push('일당 미설정');
      }
      jobCount = auto + manualExtra;
      if (manualExtra > 0) {
        notes.push(`수기 추가 ${manualExtra}일 반영`);
      }
      let partialGross: number | null = null;
      if (jobCount != null && unitAmount != null) {
        partialGross = jobCount * unitAmount;
      }
      const crewExpenseTotal = crewExpMap.get(m.id) ?? 0;
      const poolLedgerManualDeductionTotal = ledgerDedMap.get(m.id) ?? 0;
      const partialNet =
        partialGross != null
          ? Math.max(0, partialGross - crewExpenseTotal - poolLedgerManualDeductionTotal)
          : null;
      if (crewExpenseTotal > 0 && partialGross != null) {
        notes.push(`귀속 ${payMonthKey} 크루 지출 −${crewExpenseTotal.toLocaleString('ko-KR')}원`);
      }
      if (poolLedgerManualDeductionTotal > 0 && partialGross != null) {
        notes.push(
          `귀속 ${payMonthKey} 수기 장부 연결 −${poolLedgerManualDeductionTotal.toLocaleString('ko-KR')}원`,
        );
      }

      poolOut.push({
        teamMemberId: m.id,
        name: m.name,
        monthlyPayDay: payDay,
        cycleStartYmd: bounds.startYmd,
        cycleEndYmd: bounds.endYmd,
        partialEndYmd,
        payMonthKey,
        autoJobDays: auto,
        manualExtraDays: manualExtra,
        jobDays: jobCount,
        unitAmount,
        partialGross,
        crewExpenseTotal,
        poolLedgerManualDeductionTotal,
        partialNet,
        poolSettlementComplete: settledIds.has(m.id),
        notes,
      });
    }
  }

  /* 월급일 미설정 풀 멤버 */
  const inGrouped = new Set(poolOut.map((r) => r.teamMemberId));
  for (const m of poolMembers) {
    const d = m.monthlyPayDay;
    if (d != null && d >= 1 && d <= 31) continue;
    if (inGrouped.has(m.id)) continue;
    poolOut.push({
      teamMemberId: m.id,
      name: m.name,
      monthlyPayDay: d ?? 0,
      cycleStartYmd: '',
      cycleEndYmd: '',
      partialEndYmd: todayYmd,
      payMonthKey: '',
      autoJobDays: 0,
      manualExtraDays: 0,
      jobDays: null,
      unitAmount: m.payAmountPerJob,
      partialGross: null,
      crewExpenseTotal: 0,
      poolLedgerManualDeductionTotal: 0,
      partialNet: null,
      poolSettlementComplete: false,
      notes: ['월급 지급일 미설정'],
    });
  }

  poolOut.sort((a, b) => a.name.localeCompare(b.name, 'ko'));

  const marketers = await prismaClient.user.findMany({
    where: { tenantId, role: { in: ['MARKETER', 'OFFICE_STAFF'] }, isActive: true },
    select: {
      id: true,
      name: true,
      payrollPayDay: true,
      payrollMonthlySalary: true,
      hireDate: true,
      resignationDate: true,
    },
    orderBy: { name: 'asc' },
  });

  const marketerOut: PayrollExpenseForwardMarketerRow[] = [];

  const marketerByPayDay = new Map<number, typeof marketers>();
  for (const u of marketers) {
    const d = u.payrollPayDay;
    if (d == null || d < 1 || d > 31) continue;
    if (!marketerByPayDay.has(d)) marketerByPayDay.set(d, []);
    marketerByPayDay.get(d)!.push(u);
  }

  for (const payDay of [...marketerByPayDay.keys()].sort((a, b) => a - b)) {
    const group = marketerByPayDay.get(payDay)!;
    const bounds = payrollCycleBoundsKst(payDay);
    const payMonthKey = payMonthKeyAfterAccrualEnd(bounds.endYmd);

    const userIds = group.map((u) => u.id);
    const settleRows =
      userIds.length === 0
        ? []
        : await prismaClient.marketerPayrollSettlement.findMany({
            where: { userId: { in: userIds }, monthKey: payMonthKey },
            select: { userId: true },
          });
    const settledSet = new Set(settleRows.map((r) => r.userId));

    for (const u of group) {
      if (
        !employmentOverlapsMonthKst(u.hireDate, u.resignationDate, bounds.startYmd, bounds.endYmd)
      ) {
        continue;
      }

      const salary = u.payrollMonthlySalary;
      const settlementComplete = settledSet.has(u.id);
      const breakdown =
        computeMarketerAccruedEstimateForAccrualBounds({
          accrualStartYmd: bounds.startYmd,
          accrualEndYmd: bounds.endYmd,
          salary,
          todayYmd,
        }) ??
        (() => {
          const cdt = inclusiveCalendarDays(bounds.startYmd, bounds.endYmd);
          return {
            payMonthKey: payMonthKeyAfterAccrualEnd(bounds.endYmd),
            partialEndYmd: bounds.endYmd < todayYmd ? bounds.endYmd : todayYmd,
            cycleDaysTotal: cdt,
            elapsedDays: 0,
            rateBasis: 'cycle_days' as const,
            denominatorDays: cdt > 0 ? cdt : null,
            accruedEstimate: null,
          } satisfies MarketerAccruedEstimateBreakdown;
        })();

      marketerOut.push({
        userId: u.id,
        name: u.name,
        payrollPayDay: payDay,
        cycleStartYmd: bounds.startYmd,
        cycleEndYmd: bounds.endYmd,
        partialEndYmd: breakdown.partialEndYmd,
        payMonthKey: breakdown.payMonthKey,
        monthlySalary: salary,
        settlementComplete,
        rateBasis: breakdown.rateBasis,
        denominatorDays: breakdown.denominatorDays,
        elapsedDays: breakdown.elapsedDays,
        cycleDaysTotal: breakdown.cycleDaysTotal,
        accruedEstimate: breakdown.accruedEstimate,
      });
    }
  }

  for (const u of marketers) {
    const d = u.payrollPayDay;
    if (d != null && d >= 1 && d <= 31) continue;
    marketerOut.push({
      userId: u.id,
      name: u.name,
      payrollPayDay: d ?? 0,
      cycleStartYmd: '',
      cycleEndYmd: '',
      partialEndYmd: todayYmd,
      payMonthKey: '',
      monthlySalary: u.payrollMonthlySalary,
      settlementComplete: false,
      rateBasis: 'cycle_days',
      denominatorDays: null,
      elapsedDays: 0,
      cycleDaysTotal: 0,
      accruedEstimate: null,
    });
  }

  marketerOut.sort((a, b) => a.name.localeCompare(b.name, 'ko'));

  let poolPartialGross = 0;
  let poolPartialNet = 0;
  for (const r of poolOut) {
    if (typeof r.partialGross === 'number' && Number.isFinite(r.partialGross)) {
      poolPartialGross += r.partialGross;
    }
    if (typeof r.partialNet === 'number' && Number.isFinite(r.partialNet)) {
      poolPartialNet += r.partialNet;
    }
  }
  let marketerAccrued = 0;
  for (const r of marketerOut) {
    if (typeof r.accruedEstimate === 'number' && Number.isFinite(r.accruedEstimate)) {
      marketerAccrued += r.accruedEstimate;
    }
  }

  return {
    todayYmd,
    pool: poolOut,
    marketers: marketerOut,
    totals: { poolPartialGross, poolPartialNet, marketerAccrued },
  };
}
