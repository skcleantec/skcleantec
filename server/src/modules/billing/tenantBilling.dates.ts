import type { TenantBillingCycle } from '@prisma/client';

/** KST 기준 YYYY-MM-DD */
export function kstYmdFromDate(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}

export function kstStartOfDayUtc(ymd: string): Date {
  return new Date(`${ymd}T00:00:00+09:00`);
}

export function kstEndOfDayUtc(ymd: string): Date {
  return new Date(`${ymd}T23:59:59.999+09:00`);
}

export function addDaysUtc(base: Date, days: number): Date {
  const d = new Date(base.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function addMonthsClamped(base: Date, months: number): Date {
  const d = new Date(base.getTime());
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  if (d.getUTCDate() !== day) {
    d.setUTCDate(0);
  }
  return d;
}

export function addYearsClamped(base: Date, years: number): Date {
  const d = new Date(base.getTime());
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return d;
}

export function billingPeriodForStart(
  start: Date,
  cycle: TenantBillingCycle,
): { periodStart: Date; periodEnd: Date } {
  if (cycle === 'ANNUAL') {
    const periodStart = start;
    const periodEnd = addYearsClamped(start, 1);
    periodEnd.setUTCMilliseconds(periodEnd.getUTCMilliseconds() - 1);
    return { periodStart, periodEnd };
  }
  const periodStart = start;
  const periodEnd = addMonthsClamped(start, 1);
  periodEnd.setUTCMilliseconds(periodEnd.getUTCMilliseconds() - 1);
  return { periodStart, periodEnd };
}

/** KST 기준 해당 날짜의 일(1–31) */
export function kstDayOfMonthFromDate(d: Date): number {
  return Number(kstYmdFromDate(d).slice(8, 10));
}

export function dueDateFromPeriodStart(periodStart: Date): Date {
  return dueDateForPeriodStart(periodStart);
}

/**
 * 납부기한 = 해당 이용 기간 시작일 (KST) — 과금 시작일과 같은 날, 매월 반복.
 * 예: 7/13 시작 → 매월 13일이 결제일 (달력 월 기준, 30·31일 주기 아님).
 */
export function dueDateForPeriodStart(periodStart: Date, _dueDay?: number): Date {
  return kstEndOfDayUtc(kstYmdFromDate(periodStart));
}

export function nextPeriodStartAfter(periodEnd: Date): Date {
  return new Date(periodEnd.getTime() + 1);
}

/** 납부기한(KST) + 유예일 다음날 00:00 KST — 업무 차단 시작 시각 */
export function billingAccessBlockStartsAt(dueDate: Date, graceDays: number): Date {
  const dueYmd = kstYmdFromDate(dueDate);
  return addDaysUtc(kstStartOfDayUtc(dueYmd), graceDays + 1);
}

/** KST 날짜 기준 from → to 일수 (to가 미래면 양수) */
export function kstCalendarDaysUntil(from: Date, to: Date): number {
  const fromMs = kstStartOfDayUtc(kstYmdFromDate(from)).getTime();
  const toMs = kstStartOfDayUtc(kstYmdFromDate(to)).getTime();
  return Math.round((toMs - fromMs) / 86_400_000);
}
