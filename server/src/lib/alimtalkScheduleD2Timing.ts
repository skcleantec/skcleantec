/**
 * 일정 확인 알림톡(CBISEO_CUST_SCHEDULE_D2) — 발송일·위약 발생일 계산 (shared 동기화)
 */

import {
  computeFreeChangeDeadlineYmd,
  subtractDaysFromYmd,
  type OperatingCompanyCancellationPolicy,
} from './operatingCompanyCancellationPolicyCore.js';

export const SCHEDULE_D2_SEND_HOUR_KST = 18;
export const DEFAULT_SCHEDULE_D2_DAYS_BEFORE_PENALTY = 1;
export const SCHEDULE_D2_DAYS_BEFORE_PENALTY_MAX = 14;

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

export function resolveScheduleD2DaysBeforePenalty(stored: number | null | undefined): number {
  if (stored == null || !Number.isFinite(stored)) {
    return DEFAULT_SCHEDULE_D2_DAYS_BEFORE_PENALTY;
  }
  return Math.min(SCHEDULE_D2_DAYS_BEFORE_PENALTY_MAX, Math.max(0, Math.floor(stored)));
}

export function parseScheduleD2DaysBeforePenaltyInput(
  raw: unknown,
): { value: number | null } | { error: string } {
  if (raw === null || raw === undefined || raw === '') {
    return { value: null };
  }
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw).trim(), 10);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > SCHEDULE_D2_DAYS_BEFORE_PENALTY_MAX) {
    return {
      error: `발송 시점은 0~${SCHEDULE_D2_DAYS_BEFORE_PENALTY_MAX}일 사이로 입력해 주세요.`,
    };
  }
  return { value: n };
}

export function computeFirstPenaltyStartYmd(
  preferredDateYmd: string,
  policy: OperatingCompanyCancellationPolicy,
): string | null {
  if (!YMD_RE.test(preferredDateYmd.trim())) return null;
  if (!policy.enabled) return null;

  if (policy.tiers.length > 0) {
    const maxDaysBefore = Math.max(...policy.tiers.map((t) => t.daysBefore));
    return subtractDaysFromYmd(preferredDateYmd, maxDaysBefore);
  }

  const fc = policy.freeChangeDaysBefore;
  if (fc != null && fc > 0) {
    return subtractDaysFromYmd(preferredDateYmd, fc - 1);
  }

  return null;
}

export function computeScheduleD2SendYmd(
  preferredDateYmd: string,
  policy: OperatingCompanyCancellationPolicy,
  daysBeforePenaltyStart?: number | null,
): string | null {
  const penaltyStartYmd = computeFirstPenaltyStartYmd(preferredDateYmd, policy);
  if (!penaltyStartYmd) return null;
  const offset = resolveScheduleD2DaysBeforePenalty(daysBeforePenaltyStart);
  return subtractDaysFromYmd(penaltyStartYmd, offset);
}

export function computeScheduleD2FreeChangeDeadlineYmd(
  preferredDateYmd: string,
  policy: OperatingCompanyCancellationPolicy,
): string | null {
  return computeFreeChangeDeadlineYmd(preferredDateYmd, policy.freeChangeDaysBefore);
}

export function isScheduleD2SendWindowOpen(
  now: Date = new Date(),
  hourKst: number = SCHEDULE_D2_SEND_HOUR_KST,
): boolean {
  const hour = Number.parseInt(
    now.toLocaleString('en-US', { timeZone: 'Asia/Seoul', hour: 'numeric', hour12: false }),
    10,
  );
  return hour >= hourKst;
}
