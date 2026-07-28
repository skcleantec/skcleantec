/**
 * DB·API에 저장된 plan 문자열 → 현행 플랜 ID.
 * 레거시 starter(유료 10만)는 standard 로 취급한다.
 */
import type { TenantPlanId } from './tenantFeatureModules.js';

const KNOWN_PLANS = new Set<string>(['free', 'standard', 'standard_plus', 'premium']);

/** @deprecated DB에 남아 있을 수 있음 — normalizePlanId 로 standard 처리 */
export const LEGACY_STARTER_PLAN_ID = 'starter';

export function normalizePlanId(plan: string | null | undefined): TenantPlanId {
  const raw = String(plan ?? '').trim().toLowerCase();
  if (raw === LEGACY_STARTER_PLAN_ID) return 'standard';
  if (KNOWN_PLANS.has(raw)) return raw as TenantPlanId;
  return 'standard';
}

export function isKnownTenantPlanId(plan: string): plan is TenantPlanId {
  const n = String(plan).trim().toLowerCase();
  return KNOWN_PLANS.has(n) || n === LEGACY_STARTER_PLAN_ID;
}

export const TENANT_PLAN_IDS: TenantPlanId[] = ['free', 'standard', 'standard_plus', 'premium'];

export const TENANT_PLAN_ID_SET: Record<TenantPlanId | typeof LEGACY_STARTER_PLAN_ID, 1> = {
  free: 1,
  standard: 1,
  standard_plus: 1,
  premium: 1,
  starter: 1,
};
