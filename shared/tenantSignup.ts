import { TENANT_PLAN_IDS } from './tenantPlanNormalize.js';
import type { TenantPlanId } from './tenantFeatureModules.js';

/** 셀프 가입·유료 전환 승인 — 가입 후 혜택 기간(일, 약 2개월). 코인 제한 없음·유료 과금 체험 공통 */
export const TENANT_SIGNUP_GRACE_DAYS = 60;

/** @deprecated TENANT_SIGNUP_GRACE_DAYS 와 동일 */
export const TENANT_SIGNUP_PAID_TRIAL_DAYS = TENANT_SIGNUP_GRACE_DAYS;

type SignupConfigSlice = {
  signup?: {
    coinGraceEndsAt?: string | null;
    signupGraceDays?: number | null;
  };
};

/** config.signup.coinGraceEndsAt (ISO) */
export function readSignupCoinGraceEndsAt(config: unknown): string | null {
  const raw = (config as SignupConfigSlice)?.signup?.coinGraceEndsAt;
  if (typeof raw !== 'string' || !raw.trim()) return null;
  return raw;
}

/** 가입 후 grace 기간 — 코인 차감 없음 (Free·유료 셀프 가입·승인 체험) */
export function isSignupCoinGraceActive(
  input: {
    config?: unknown;
    trialEndsAt?: string | Date | null;
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

/** 셀프 가입(/signup)에서 선택 가능한 플랜 */
export const TENANT_SELF_SIGNUP_PLAN_IDS: TenantPlanId[] = [...TENANT_PLAN_IDS];

/** 셀프 가입 시 slug 로 사용 불가 */
export const TENANT_SIGNUP_RESERVED_SLUGS = [
  'admin',
  'api',
  'app',
  'cbiseo',
  'crew',
  'help',
  'login',
  'order',
  'platform',
  'signup',
  'sk',
  'static',
  'team',
  'www',
] as const;

/** 셀프 가입 후 유료 전환 신청 가능 플랜 (Free 제외) */
export const TENANT_SELF_SIGNUP_UPGRADE_PLAN_IDS: Exclude<TenantPlanId, 'free'>[] = TENANT_PLAN_IDS.filter(
  (id): id is Exclude<TenantPlanId, 'free'> => id !== 'free',
);

export function isTenantSignupReservedSlug(slug: string): boolean {
  return (TENANT_SIGNUP_RESERVED_SLUGS as readonly string[]).includes(slug.trim().toLowerCase());
}

/** 셀프 가입 API — 허용 플랜만. 미입력·빈 값은 free */
export function normalizeSignupPlanId(plan: string | null | undefined): TenantPlanId {
  const raw = String(plan ?? '').trim().toLowerCase();
  if (!raw) return 'free';
  if ((TENANT_SELF_SIGNUP_PLAN_IDS as readonly string[]).includes(raw)) {
    return raw as TenantPlanId;
  }
  throw new Error('INVALID_SIGNUP_PLAN');
}

export function isValidSignupPlanId(plan: string | null | undefined): boolean {
  const raw = String(plan ?? '').trim().toLowerCase();
  if (!raw) return true;
  return (TENANT_SELF_SIGNUP_PLAN_IDS as readonly string[]).includes(raw);
}
