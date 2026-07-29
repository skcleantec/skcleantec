import { TENANT_PLAN_IDS } from './tenantPlanNormalize.js';
import type { TenantPlanId } from './tenantFeatureModules.js';

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
