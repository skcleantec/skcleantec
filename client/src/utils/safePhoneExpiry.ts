/** 0504 안심번호는 받은 지 48시간이 지나면 끊기거나 다른 사람에게 넘어간다. */
export const SAFE_PHONE_VALID_HOURS = 48;

export type SafePhoneExpiry =
  | { kind: 'none' }
  | { kind: 'active'; hoursLeft: number; safePhone: string; hasOtherPhone: boolean }
  | { kind: 'expired'; safePhone: string; hasOtherPhone: boolean };

function digitsOf(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\D/g, '');
}

export function isExpiringSafePhone(raw: string | null | undefined): boolean {
  const d = digitsOf(raw);
  return d.startsWith('0504') && d.length >= 10;
}

/** 등록일 기준으로 안심번호가 아직 쓸 수 있는지 본다. */
export function getSafePhoneExpiry(
  phones: Array<string | null | undefined>,
  createdAt: string | null | undefined,
  now: number = Date.now(),
): SafePhoneExpiry {
  const safePhone = phones.find((p) => isExpiringSafePhone(p));
  if (!safePhone) return { kind: 'none' };
  const hasOtherPhone = phones.some((p) => !isExpiringSafePhone(p) && digitsOf(p).length >= 8);
  const created = createdAt ? new Date(createdAt).getTime() : NaN;
  if (!Number.isFinite(created)) return { kind: 'none' };
  const hoursPassed = (now - created) / 3_600_000;
  if (hoursPassed >= SAFE_PHONE_VALID_HOURS) return { kind: 'expired', safePhone, hasOtherPhone };
  return {
    kind: 'active',
    hoursLeft: Math.max(1, Math.ceil(SAFE_PHONE_VALID_HOURS - hoursPassed)),
    safePhone,
    hasOtherPhone,
  };
}

/** 이 번호로 걸면 안 되는지 — 48시간 지난 안심번호일 때만 true */
export function isSafePhoneCallBlocked(
  dialPhone: string | null | undefined,
  createdAt: string | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!isExpiringSafePhone(dialPhone)) return false;
  return getSafePhoneExpiry([dialPhone], createdAt, now).kind === 'expired';
}
