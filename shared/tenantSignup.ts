import { TENANT_PLAN_IDS } from './tenantPlanNormalize.js';
import type { TenantPlanId } from './tenantFeatureModules.js';

/** 셀프 가입 시 유료 플랜 선택 — 무료 체험 기간(일) */
export const TENANT_SIGNUP_PAID_TRIAL_DAYS = 60;

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
