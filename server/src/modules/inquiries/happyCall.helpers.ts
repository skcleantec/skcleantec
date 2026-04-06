import { kstDayRangeYmd } from './inquiryListDateRange.js';

/** KST 기준 날짜 문자열 */
export function kstYmdFromDate(d: Date): string {
  return d.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

export function addDaysToYmdKst(ymd: string, delta: number): string {
  const t = new Date(`${ymd}T12:00:00+09:00`);
  t.setDate(t.getDate() + delta);
  return t.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

/** 해피콜 완료 마감: 작업일(예약일) 전날 KST 23:59:59.999 */
export function happyCallDeadlineEnd(preferredDate: Date): Date {
  const workYmd = kstYmdFromDate(preferredDate);
  const prevYmd = addDaysToYmdKst(workYmd, -1);
  const r = kstDayRangeYmd(prevYmd);
  if (!r) return new Date(0);
  return r.lte;
}

const HAPPY_CALL_BLOCK = new Set(['CANCELLED', 'PENDING']);

export function isHappyCallEligible(status: string, preferredDate: Date | null): boolean {
  if (!preferredDate) return false;
  if (HAPPY_CALL_BLOCK.has(status)) return false;
  return true;
}

/** 마감 지남(미완) */
export function isHappyCallOverdue(
  now: Date,
  preferredDate: Date | null,
  happyCallCompletedAt: Date | null,
  status: string
): boolean {
  if (!isHappyCallEligible(status, preferredDate) || happyCallCompletedAt) return false;
  if (!preferredDate) return false;
  return now > happyCallDeadlineEnd(preferredDate);
}

/** 마감 전이지만 미완(주의) */
export function isHappyCallPendingBeforeDeadline(
  now: Date,
  preferredDate: Date | null,
  happyCallCompletedAt: Date | null,
  status: string
): boolean {
  if (!isHappyCallEligible(status, preferredDate) || happyCallCompletedAt) return false;
  if (!preferredDate) return false;
  return now <= happyCallDeadlineEnd(preferredDate);
}
