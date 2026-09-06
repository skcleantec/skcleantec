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
  'COMPLETED',
]);

export function isHappyCallEligible(status: string, preferredDate: Date | null): boolean {
  if (!preferredDate) return false;
  if (HAPPY_CALL_BLOCK.has(status as InquiryStatus)) return false;
  return true;
}

/** 마감(전날 말일) 이후에 생긴 접수 — 전날 해피콜 창이 없음(당일 예약 등) */
export function wasCreatedAfterHappyCallDeadline(
  preferredDate: Date | null,
  createdAt: Date | null | undefined,
): boolean {
  if (!preferredDate || !createdAt) return false;
  return createdAt.getTime() > happyCallDeadlineEnd(preferredDate).getTime();
}

/** 마감 지남(미완). 마감 이후 생긴 접수는 초과로 보지 않음 */
export function isHappyCallOverdue(
  now: Date,
  preferredDate: Date | null,
  happyCallCompletedAt: Date | null,
  status: string,
  createdAt?: Date | null,
): boolean {
  if (!isHappyCallEligible(status, preferredDate) || happyCallCompletedAt) return false;
  if (!preferredDate) return false;
  if (wasCreatedAfterHappyCallDeadline(preferredDate, createdAt)) return false;
  return now > happyCallDeadlineEnd(preferredDate);
}

/** 해피콜 반복 알림 시작: 작업일(예약일) 전날 KST 18:00 */
export function happyCallReminderWindowStart(preferredDate: Date): Date {
  const workYmd = kstYmdFromDate(preferredDate);
  const prevYmd = addDaysToYmdKst(workYmd, -1);
  return new Date(`${prevYmd}T18:00:00+09:00`);
}

/**
 * 시간당 푸시 후보: 전날 18:00 이후·미완.
 * 마감 이후 생긴 접수(당일 예약)는 전날 창이 없으므로 제외.
 * 마감 이후 반복은 호출측에서 `repeatEnabled`·횟수 상한을 검사한다.
 */
export function isHappyCallInHourlyReminderWindow(
  now: Date,
  preferredDate: Date | null,
  happyCallCompletedAt: Date | null,
  status: string,
  createdAt?: Date | null,
): boolean {
  if (!isHappyCallEligible(status, preferredDate) || happyCallCompletedAt) return false;
  if (!preferredDate) return false;
  if (wasCreatedAfterHappyCallDeadline(preferredDate, createdAt)) return false;
  return now >= happyCallReminderWindowStart(preferredDate);
}

/** 15분 cron DB 조회용 — 오늘·내일 예약만 (지난 예약일 미완은 푸시 제외) */
export function happyCallCronPreferredDateRange(now: Date): { gte: Date; lte: Date } | null {
  const todayYmd = kstYmdFromDate(now);
  const tomorrowYmd = addDaysToYmdKst(todayYmd, 1);
  const todayRange = kstDayRangeYmd(todayYmd);
  const tomorrowRange = kstDayRangeYmd(tomorrowYmd);
  if (!todayRange || !tomorrowRange) return null;

  const eveStart = new Date(`${todayYmd}T18:00:00+09:00`);
  if (now >= eveStart) {
    /** 오늘 18:00~ — 내일 작업(전날 18:00 알림 창) + 오늘 작업(당일 미완) */
    return { gte: todayRange.gte, lte: tomorrowRange.lte };
  }
  /** 18:00 이전 — 「오늘」 예약일 미완만 (내일 작업 전날 알림은 18:00부터) */
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
