import { kstDayRangeYmd } from './inquiryListDateRange.js';
import type { InquiryStatus } from '@prisma/client';

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

const HAPPY_CALL_BLOCK = new Set<InquiryStatus>([
  'CANCELLED',
  'ON_HOLD',
  'PENDING',
  'DEPOSIT_PENDING',
  'DEPOSIT_COMPLETED',
  'ORDER_FORM_PENDING',
]);

export function isHappyCallEligible(status: string, preferredDate: Date | null): boolean {
  if (!preferredDate) return false;
  if (HAPPY_CALL_BLOCK.has(status as InquiryStatus)) return false;
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

/** 해피콜 반복 알림 시작: 작업일(예약일) 전날 KST 18:00 */
export function happyCallReminderWindowStart(preferredDate: Date): Date {
  const workYmd = kstYmdFromDate(preferredDate);
  const prevYmd = addDaysToYmdKst(workYmd, -1);
  return new Date(`${prevYmd}T18:00:00+09:00`);
}

/** 전날 18:00 ~ 미완 구간(마감 전·후 포함) */
export function isHappyCallInHourlyReminderWindow(
  now: Date,
  preferredDate: Date | null,
  happyCallCompletedAt: Date | null,
  status: string,
): boolean {
  if (!isHappyCallEligible(status, preferredDate) || happyCallCompletedAt) return false;
  if (!preferredDate) return false;
  return now >= happyCallReminderWindowStart(preferredDate);
}

/** 15분 cron DB 조회용 — 과거 예약일 전량 스캔 방지 */
export function happyCallCronPreferredDateRange(now: Date): { gte: Date; lte: Date } | null {
  const todayYmd = kstYmdFromDate(now);
  const tomorrowYmd = addDaysToYmdKst(todayYmd, 1);
  const todayRange = kstDayRangeYmd(todayYmd);
  const tomorrowRange = kstDayRangeYmd(tomorrowYmd);
  if (!todayRange || !tomorrowRange) return null;

  const eveStart = new Date(`${todayYmd}T18:00:00+09:00`);
  if (now >= eveStart) {
    /** 오늘 18:00~ — 내일 작업(전날 18:00 알림 창) + 오늘 작업(당일 미완·연체) */
    return { gte: todayRange.gte, lte: tomorrowRange.lte };
  }
  /** 18:00 이전 — 어제 18:00부터 열린 「오늘」 작업 미완만 후보 */
  return { gte: todayRange.gte, lte: todayRange.lte };
}

export const HAPPY_CALL_INELIGIBLE_STATUSES: InquiryStatus[] = [...HAPPY_CALL_BLOCK];

/** 마감 전이지만 미완(주의) */
export function isHappyCallPendingBeforeDeadline(
  now: Date,
  preferredDate: Date | null,
  happyCallCompletedAt: Date | null,
  status: string,
): boolean {
  if (!isHappyCallEligible(status, preferredDate) || happyCallCompletedAt) return false;
  if (!preferredDate) return false;
  return now <= happyCallDeadlineEnd(preferredDate);
}
