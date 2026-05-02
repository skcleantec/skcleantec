import { kstMonthRangeYm } from '../inquiries/inquiryListDateRange.js';
import { dateToYmdKst, employmentOverlapsMonthKst } from '../users/userEmployment.js';

export type MarketerSettlementSlice = {
  monthKey: string;
  scheduledMonthlySalary: number | null;
  settledAmount: number;
};

export function compareMonthKey(a: string, b: string): number {
  return a.localeCompare(b);
}

export function nextMonthKey(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  let nm = m + 1;
  let ny = y;
  if (nm > 12) {
    nm = 1;
    ny += 1;
  }
  return `${ny}-${String(nm).padStart(2, '0')}`;
}

export function prevMonthKey(monthKey: string): string | null {
  const [y, m] = monthKey.split('-').map(Number);
  let nm = m - 1;
  let ny = y;
  if (nm < 1) {
    nm = 12;
    ny -= 1;
  }
  if (ny < 1900) return null;
  return `${ny}-${String(nm).padStart(2, '0')}`;
}

export function hireMonthKeyFromUser(hireDate: Date | null): string | null {
  if (!hireDate) return null;
  return dateToYmdKst(hireDate).slice(0, 7);
}

/** 귀속 월 시뮬레이션 구간 시작 월 */
export function marketerLedgerStartMonthKey(
  hireDate: Date | null,
  settlementsAscFull: readonly MarketerSettlementSlice[],
): string | null {
  const hireMk = hireMonthKeyFromUser(hireDate);
  const firstSettleMk = settlementsAscFull[0]?.monthKey ?? null;
  if (hireMk && firstSettleMk) {
    return compareMonthKey(hireMk, firstSettleMk) <= 0 ? hireMk : firstSettleMk;
  }
  return hireMk ?? firstSettleMk ?? null;
}

/**
 * targetMonthKey 귀속분 반영 전까지의 미정산 이월액 (양수만).
 * - settlementsAscFull: 해당 사용자 전체 정산 행(월키 오름차순) — 시뮬레이션 시작월 결정용
 * - settlementsAscBeforeTarget: 귀속 월 미만 행만 — 해당 월 이전 구간만 반복
 * - liveMonthlySalary: 정산 이력 없는 과거 월의 급여 추정(등록 월급 변경 시 과거 추정 오차 가능)
 */
export function simulateMarketerOpeningCarryForward(params: {
  targetMonthKey: string;
  hireDate: Date | null;
  resignationDate: Date | null;
  liveMonthlySalary: number | null;
  settlementsAscFull: readonly MarketerSettlementSlice[];
  settlementsAscBeforeTarget: readonly MarketerSettlementSlice[];
}): number {
  const {
    targetMonthKey,
    hireDate,
    resignationDate,
    liveMonthlySalary,
    settlementsAscFull,
    settlementsAscBeforeTarget,
  } = params;

  const prevMk = prevMonthKey(targetMonthKey);
  if (!prevMk) return 0;

  const settlementMap = new Map(
    settlementsAscBeforeTarget.map((s) => [
      s.monthKey,
      { scheduledMonthlySalary: s.scheduledMonthlySalary, settledAmount: s.settledAmount },
    ]),
  );

  let ledgerStart = marketerLedgerStartMonthKey(hireDate, settlementsAscFull);
  if (!ledgerStart || compareMonthKey(ledgerStart, prevMk) > 0) {
    return 0;
  }

  let opening = 0;
  let cur = ledgerStart;
  while (compareMonthKey(cur, prevMk) <= 0) {
    const range = kstMonthRangeYm(cur);
    if (!range) break;

    const monthStartYmd = dateToYmdKst(range.gte);
    const monthEndYmd = dateToYmdKst(range.lte);
    const employed = employmentOverlapsMonthKst(hireDate, resignationDate, monthStartYmd, monthEndYmd);
    const st = settlementMap.get(cur);

    if (!employed && !st) {
      cur = nextMonthKey(cur);
      continue;
    }

    const salaryPart = employed ? st?.scheduledMonthlySalary ?? liveMonthlySalary ?? 0 : 0;
    const due = opening + salaryPart;
    const paid = st?.settledAmount ?? 0;
    opening = Math.max(0, due - paid);
    cur = nextMonthKey(cur);
  }

  return opening;
}

/** 귀속 월 지급 예정 합계(이월 + 등록 월급). 둘 다 0 이하면 null */
export function marketerTotalDue(openingCarryForward: number, monthlySalary: number | null): number | null {
  const salaryPart = monthlySalary ?? 0;
  const total = openingCarryForward + salaryPart;
  if (total <= 0) return null;
  return total;
}

export function marketerRemainderAfterSettle(
  openingCarryForward: number,
  scheduledMonthlySalary: number | null,
  settledAmount: number,
): number {
  const salaryPart = scheduledMonthlySalary ?? 0;
  const due = openingCarryForward + salaryPart;
  return Math.max(0, due - settledAmount);
}
