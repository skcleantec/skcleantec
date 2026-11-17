/** 업체 목록 — 최근 가입·이벤트 체험. 화면에는 이 결과만 보여 준다. */

const NEW_SIGNUP_DAYS = 30;

type SignupSlice = {
  signup?: {
    coinGraceEndsAt?: string | null;
    trialEventId?: string | null;
    trialEventName?: string | null;
  };
};

export function kstYmd(date: Date): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(date);
  const num = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? '0');
  return { y: num('year'), m: num('month'), d: num('day') };
}

/** 오늘(KST)을 포함한 최근 30일. 중지 업체도 같은 기준. */
export function isNewTenantSignup(createdAt: Date | string, now: Date = new Date()): boolean {
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return false;
  const start = kstYmd(created);
  const today = kstYmd(now);
  const diff = Math.round(
    (Date.UTC(today.y, today.m - 1, today.d) - Date.UTC(start.y, start.m - 1, start.d)) / 86_400_000,
  );
  return diff >= 0 && diff < NEW_SIGNUP_DAYS;
}

function readText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function platformTenantSignupMeta(
  input: { config: unknown; trialEndsAt: Date | string | null; createdAt: Date | string },
  now: Date = new Date(),
): {
  createdAt: string;
  trialEndsAt: string | null;
  eventEndsAt: string | null;
  eventTrialActive: boolean;
  eventName: string | null;
  newSignup: boolean;
} {
  const signup = (input.config as SignupSlice | null)?.signup;
  const trialEndsAt = input.trialEndsAt ? new Date(input.trialEndsAt).toISOString() : null;
  const graceEnd = readText(signup?.coinGraceEndsAt);
  const eventId = readText(signup?.trialEventId);
  const eventName = readText(signup?.trialEventName);
  const eventEndsAt = trialEndsAt ?? graceEnd;
  const eventEndMs = eventEndsAt ? new Date(eventEndsAt).getTime() : NaN;
  const eventTrialActive = Boolean(eventId) && Number.isFinite(eventEndMs) && eventEndMs > now.getTime();
  return {
    createdAt: new Date(input.createdAt).toISOString(),
    trialEndsAt,
    eventEndsAt: eventTrialActive ? eventEndsAt : null,
    eventTrialActive,
    eventName,
    newSignup: isNewTenantSignup(input.createdAt, now),
  };
}
