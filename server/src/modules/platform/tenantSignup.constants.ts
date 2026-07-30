/** 셀프 가입·유료 전환 — 서버 전용 상수 (client는 shared/tenantSignup.ts) */

/** 셀프 가입 시 유료 플랜 — 무료 체험 일수 (client shared/tenantSignup.ts 와 동기화) */
export const TENANT_SIGNUP_PAID_TRIAL_DAYS = 60;

export const TENANT_SELF_SIGNUP_PLAN_IDS = ['free', 'standard', 'standard_plus', 'premium'] as const;

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

export const TENANT_SELF_SIGNUP_UPGRADE_PLAN_IDS = ['standard', 'standard_plus', 'premium'] as const;

export function isTenantSignupReservedSlug(slug: string): boolean {
  return (TENANT_SIGNUP_RESERVED_SLUGS as readonly string[]).includes(slug.trim().toLowerCase());
}

/** 셀프 가입 — 허용 플랜만. 미입력·빈 값은 free (@see shared/tenantSignup.ts) */
export function normalizeSignupPlanId(plan: string | null | undefined): import('../tenants/tenantFeatureCatalog.js').TenantPlanId {
  const raw = String(plan ?? '').trim().toLowerCase();
  if (!raw) return 'free';
  if ((TENANT_SELF_SIGNUP_PLAN_IDS as readonly string[]).includes(raw)) {
    return raw as import('../tenants/tenantFeatureCatalog.js').TenantPlanId;
  }
  throw new Error('INVALID_SIGNUP_PLAN');
}
