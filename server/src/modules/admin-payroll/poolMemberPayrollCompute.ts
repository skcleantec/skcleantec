import type { PrismaClient } from '@prisma/client';
import { kstMonthRangeYm } from '../inquiries/inquiryListDateRange.js';
import {
  crewMemberNoteIncludesTeamMember,
  distinctPayrollDaysForPoolMember,
  payYmdInMonth,
  payrollAccrualPeriodForPaymentDate,
  payrollCyclePreferredDateWhere,
} from '../teams/teamMemberPayrollCycle.js';
import { dateToYmdKst } from '../users/userEmployment.js';

export type PayrollDetailLineOut = {
  inquiryId: string;
  inquiryNumber: string | null;
  customerName: string;
  nickname: string | null;
  preferredDateYmd: string | null;
  crewMemberNote: string | null;
};

export type CrewExpenseLedgerLineOut = {
  id: string;
  amount: number;
  memo: string | null;
  createdAt: string;
  crewGroupName: string;
  attachmentCount: number;
};

export type PoolMemberPayrollComputation = {
  monthKey: string;
  monthLabel: string;
  member: { id: string; name: string; nameTh: string | null };
  payDateYmd: string | null;
  accrualStartYmd: string | null;
  accrualEndYmd: string | null;
  unitAmount: number | null;
  poolSystemDays: number | null;
  poolManualExtraDays: number;
  jobCount: number | null;
  /** 근무일×일당 예상 급여(차감 전) */
  amount: number | null;
  /** 해당 귀속 월 크루 등록 지출 합계 */
  crewExpenseTotal: number;
  /** 예상 급여 − 지출 (0 미만이면 0) — 정산 확정 금액 기준 */
  amountNet: number | null;
  crewExpenseLines: CrewExpenseLedgerLineOut[];
  notes: string[];
  lines: PayrollDetailLineOut[];
};

const MONTH_KEY = /^\d{4}-\d{2}$/;

export async function computePoolMemberPayrollDetail(
  prisma: PrismaClient,
  teamMemberId: string,
  monthKey: string,
): Promise<PoolMemberPayrollComputation | null> {
  if (!MONTH_KEY.test(monthKey) || !kstMonthRangeYm(monthKey)) {
    throw new Error('INVALID_MONTH_KEY');
  }

  const [yStr, mStr] = monthKey.split('-');
  const calYear = parseInt(yStr, 10);
  const calMonthNum = parseInt(mStr, 10);
  const monthIndex = calMonthNum - 1;
  const monthLabel = `${calYear}년 ${calMonthNum}월`;

  const m = await prisma.teamMember.findFirst({
    where: { id: teamMemberId, teamId: null, isActive: true },
    select: {
      id: true,
      name: true,
      nameTh: true,
      monthlyPayDay: true,
      payAmountPerJob: true,
    },
  });

  if (!m) return null;

  const adjustRow = await prisma.teamMemberPayrollMonthAdjust.findUnique({
    where: {
      teamMemberId_monthKey: { teamMemberId, monthKey },
    },
  });
  const manualExtraRaw = adjustRow?.extraWorkDays ?? 0;
  const manualExtra =
    typeof manualExtraRaw === 'number' &&
    Number.isFinite(manualExtraRaw) &&
    manualExtraRaw > 0
      ? Math.min(93, Math.floor(manualExtraRaw))
      : 0;

  const notes: string[] = [];
  let payDateYmd: string | null = null;
  let accrualStartYmd: string | null = null;
  let accrualEndYmd: string | null = null;
  let unitAmount: number | null = m.payAmountPerJob;

  if (m.monthlyPayDay == null || m.monthlyPayDay < 1 || m.monthlyPayDay > 31) {
    notes.push('월급 지급일 미설정');
  } else {
    payDateYmd = payYmdInMonth(calYear, monthIndex, m.monthlyPayDay);
    const period = payrollAccrualPeriodForPaymentDate(payDateYmd, m.monthlyPayDay);
    if (period) {
      accrualStartYmd = period.startYmd;
      accrualEndYmd = period.endYmd;
    }
  }

  if (m.payAmountPerJob == null) {
    notes.push('일당(1일 급여) 미설정');
    unitAmount = null;
  }

  let lines: PayrollDetailLineOut[] = [];
  let poolSystemDays: number | null = null;
  let autoDays: number | null = null;

  if (payDateYmd && accrualStartYmd && accrualEndYmd) {
    const bounds = payrollCyclePreferredDateWhere(accrualStartYmd, accrualEndYmd);
    const inquiries = await prisma.inquiry.findMany({
      where: {
        preferredDate: { gte: bounds.gte, lte: bounds.lte },
        status: { notIn: ['CANCELLED', 'ON_HOLD'] },
      },
      select: {
        id: true,
        inquiryNumber: true,
        customerName: true,
        nickname: true,
        preferredDate: true,
        crewMemberNote: true,
      },
      orderBy: [{ preferredDate: 'asc' }],
    });

    autoDays = distinctPayrollDaysForPoolMember(
      inquiries.map((i) => ({
        crewMemberNote: i.crewMemberNote,
        preferredDate: i.preferredDate,
      })),
      m,
    );
    poolSystemDays = autoDays;

    lines = inquiries
      .filter((inq) => crewMemberNoteIncludesTeamMember(inq.crewMemberNote, m))
      .map((inq) => ({
        inquiryId: inq.id,
        inquiryNumber: inq.inquiryNumber,
        customerName: inq.customerName,
        nickname: inq.nickname,
        preferredDateYmd: inq.preferredDate ? dateToYmdKst(inq.preferredDate) : null,
        crewMemberNote: inq.crewMemberNote,
      }));
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

  const amount = unitAmount != null && jobCount !== null ? jobCount * unitAmount : null;

  const expenseRows = await prisma.teamCrewGroupExpense.findMany({
    where: { teamMemberId, monthKey },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      amount: true,
      memo: true,
      createdAt: true,
      group: { select: { name: true } },
      attachments: { select: { id: true } },
    },
  });

  const crewExpenseTotal = expenseRows.reduce((s, row) => s + row.amount, 0);
  const crewExpenseLines: CrewExpenseLedgerLineOut[] = expenseRows.map((row) => ({
    id: row.id,
    amount: row.amount,
    memo: row.memo,
    createdAt: row.createdAt.toISOString(),
    crewGroupName: row.group.name,
    attachmentCount: row.attachments.length,
  }));

  let amountNet: number | null = null;
  if (amount != null) {
    amountNet = Math.max(0, amount - crewExpenseTotal);
    if (crewExpenseTotal > 0) {
      notes.push(
        `크루 등록 지출 ${crewExpenseTotal.toLocaleString('ko-KR')}원 차감 → 실지급 예상 ${amountNet.toLocaleString('ko-KR')}원`,
      );
    }
  }

  return {
    monthKey,
    monthLabel,
    member: { id: m.id, name: m.name, nameTh: m.nameTh },
    payDateYmd,
    accrualStartYmd,
    accrualEndYmd,
    unitAmount,
    poolSystemDays,
    poolManualExtraDays: manualExtra,
    jobCount,
    amount,
    crewExpenseTotal,
    amountNet,
    crewExpenseLines,
    notes,
    lines,
  };
}
