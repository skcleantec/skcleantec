/**
 * 가입 grace(약 2개월) — shared/tenantSignup.ts 와 동기화
 */
import { TENANT_SIGNUP_GRACE_DAYS } from '../platform/tenantSignup.constants.js';

export { TENANT_SIGNUP_GRACE_DAYS };

type SignupConfigSlice = {
  signup?: {
    coinGraceEndsAt?: string | null;
    signupGraceDays?: number | null;
  };
};

export function readSignupCoinGraceEndsAt(config: unknown): string | null {
  const raw = (config as SignupConfigSlice)?.signup?.coinGraceEndsAt;
  if (typeof raw !== 'string' || !raw.trim()) return null;
  return raw;
}

export function isSignupCoinGraceActive(
  input: {
    config?: unknown;
    trialEndsAt?: Date | string | null;
    status?: string;
  },
  now: Date = new Date(),
): boolean {
  const graceEnd = readSignupCoinGraceEndsAt(input.config);
  if (graceEnd && new Date(graceEnd).getTime() > now.getTime()) return true;
  if (input.status === 'TRIAL' && input.trialEndsAt) {
    return new Date(input.trialEndsAt).getTime() > now.getTime();
  }
  return false;
}
