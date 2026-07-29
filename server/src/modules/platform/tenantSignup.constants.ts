/** 셀프 가입·유료 전환 — 서버 전용 상수 (client는 shared/tenantSignup.ts) */

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
