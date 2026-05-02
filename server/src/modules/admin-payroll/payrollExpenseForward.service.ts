import type { PrismaClient } from '@prisma/client';
import {
  payrollCycleBoundsKst,
  payrollCyclePreferredDateWhere,
  crewMemberNoteIncludesTeamMember,
} from '../teams/teamMemberPayrollCycle.js';
import { dateToYmdKst, employmentOverlapsMonthKst } from '../users/userEmployment.js';
import { sumCrewExpensesByMemberIdsForMonth } from '../crew/crewGroupExpense.service.js';

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

function calendarDaysInMonth(monthKey: string): number | null {
  const m = /^(\d{4})-(\d{2})$/.exec(monthKey.trim());
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  if (!Number.isFinite(y) || mo < 1 || mo > 12) return null;
  return new Date(Date.UTC(y, mo, 0)).getUTCDate();
}

function prevCalendarMonthKey(monthKey: string): string | null {
  const m = /^(\d{4})-(\d{2})$/.exec(monthKey.trim());
  if (!m) return null;
  let y = parseInt(m[1], 10);
  let mo = parseInt(m[2], 10);
  mo -= 1;
  if (mo < 1) {
    mo = 12;
    y -= 1;
  }
  if (y < 1900) return null;
  return `${y}-${String(mo).padStart(2, '0')}`;
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
  rateBasis: 'cycle_days' | 'prev_calendar_month';
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

export async function computePayrollExpenseForward(prismaClient: PrismaClient): Promise<PayrollExpenseForwardPayload> {
  const todayYmd = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);

  const poolMembers = await prismaClient.teamMember.findMany({
    where: { teamId: null, isActive: true },
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

  for (const payDay of [...byPayDay.keys()].sort((a, b) => a - b)) {
    const members = byPayDay.get(payDay)!;
    const bounds = payrollCycleBoundsKst(payDay);
    const partialEndYmd = bounds.endYmd < todayYmd ? bounds.endYmd : todayYmd;
    const payMonthKey = payMonthKeyAfterAccrualEnd(bounds.endYmd);

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
          partialNet: null,
          poolSettlementComplete: false,
          notes,
        });
      }
      continue;
    }

    const env = payrollCyclePreferredDateWhere(bounds.startYmd, partialEndYmd);
    const payrollDaysByMemberId = new Map<string, Set<string>>();
    for (const pm of members) {
      payrollDaysByMemberId.set(pm.id, new Set());
    }

    let cursorId: string | undefined;
    for (;;) {
      const batch = await prismaClient.inquiry.findMany({
        where: {
          preferredDate: { gte: env.gte, lte: env.lte },
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
        if (ymd < bounds.startYmd || ymd > partialEndYmd) continue;
        for (const mem of members) {
          if (!crewMemberNoteIncludesTeamMember(inq.crewMemberNote, mem)) continue;
          payrollDaysByMemberId.get(mem.id)?.add(ymd);
        }
      }
      cursorId = batch[batch.length - 1]!.id;
    }

    const ids = members.map((x) => x.id);
    const [adjusts, settleRows, crewExpMap] = await Promise.all([
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
      const partialNet =
        partialGross != null ? Math.max(0, partialGross - crewExpenseTotal) : null;
      if (crewExpenseTotal > 0 && partialGross != null) {
        notes.push(`귀속 ${payMonthKey} 크루 지출 −${crewExpenseTotal.toLocaleString('ko-KR')}원`);
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
      partialNet: null,
      poolSettlementComplete: false,
      notes: ['월급 지급일 미설정'],
    });
  }

  poolOut.sort((a, b) => a.name.localeCompare(b.name, 'ko'));

  const marketers = await prismaClient.user.findMany({
    where: { role: 'MARKETER', isActive: true },
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
    const partialEndYmd = bounds.endYmd < todayYmd ? bounds.endYmd : todayYmd;
    const payMonthKey = payMonthKeyAfterAccrualEnd(bounds.endYmd);
    const cycleDaysTotal = inclusiveCalendarDays(bounds.startYmd, bounds.endYmd);
    const elapsedDays =
      partialEndYmd < bounds.startYmd ? 0 : inclusiveCalendarDays(bounds.startYmd, partialEndYmd);

    const userIds = group.map((u) => u.id);
    const settleRows =
      userIds.length === 0
        ? []
        : await prismaClient.marketerPayrollSettlement.findMany({
            where: { userId: { in: userIds }, monthKey: payMonthKey },
            select: { userId: true },
          });
    const settledSet = new Set(settleRows.map((r) => r.userId));

    const startMonthKey = bounds.startYmd.slice(0, 7);
    const prevMk = prevCalendarMonthKey(startMonthKey);
    const prevDenom = prevMk ? calendarDaysInMonth(prevMk) : null;

    for (const u of group) {
      if (
        !employmentOverlapsMonthKst(u.hireDate, u.resignationDate, bounds.startYmd, bounds.endYmd)
      ) {
        continue;
      }

      const salary = u.payrollMonthlySalary;
      const settlementComplete = settledSet.has(u.id);
      let rateBasis: 'cycle_days' | 'prev_calendar_month' = settlementComplete
        ? 'cycle_days'
        : 'prev_calendar_month';
      let denominatorDays: number | null = null;
      if (settlementComplete) {
        denominatorDays = cycleDaysTotal > 0 ? cycleDaysTotal : null;
      } else {
        denominatorDays = prevDenom;
      }

      let accruedEstimate: number | null = null;
      if (
        salary != null &&
        Number.isFinite(salary) &&
        salary > 0 &&
        denominatorDays != null &&
        denominatorDays > 0 &&
        elapsedDays > 0
      ) {
        accruedEstimate = Math.round((salary * elapsedDays) / denominatorDays);
      }

      marketerOut.push({
        userId: u.id,
        name: u.name,
        payrollPayDay: payDay,
        cycleStartYmd: bounds.startYmd,
        cycleEndYmd: bounds.endYmd,
        partialEndYmd,
        payMonthKey,
        monthlySalary: salary,
        settlementComplete,
        rateBasis,
        denominatorDays,
        elapsedDays,
        cycleDaysTotal,
        accruedEstimate,
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
      rateBasis: 'prev_calendar_month',
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
