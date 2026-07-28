/**
 * @see shared/tenantBilling.ts · shared/tenantPlanCatalog.ts — 동기화
 */
import type { TenantPlanId } from '../tenants/tenantFeatureCatalog.js';
import { normalizePlanId } from '../tenants/tenantFeatureCatalog.js';

const MONTHLY_PRICE_KRW: Record<TenantPlanId, number> = {
  free: 0,
  standard: 100_000,
  standard_plus: 200_000,
  premium: 300_000,
};

export const TENANT_PREMIUM_EXTRA_BRAND_MONTHLY_KRW = 200_000;

export const TENANT_TRIAL_DAYS = 7;
export const TENANT_PREPAID_SERVICE_DELAY_DAYS = 7;
export const TENANT_BILLING_ANNUAL_DISCOUNT_RATE = 0.15;
export const TENANT_BILLING_DEFAULT_GRACE_DAYS = 3;
export const TENANT_BILLING_DEFAULT_DUE_DAY = 25;

export type TenantBillingCycle = 'MONTHLY' | 'ANNUAL';

export const TENANT_PREMIUM_INCLUDED_BRAND_SLOTS = 2;

export function premiumMonthlyPriceKrw(activeBrandCount: number): number {
  const base = MONTHLY_PRICE_KRW.premium;
  const extra =
    Math.max(0, activeBrandCount - TENANT_PREMIUM_INCLUDED_BRAND_SLOTS) *
    TENANT_PREMIUM_EXTRA_BRAND_MONTHLY_KRW;
  return base + extra;
}

export function catalogMonthlyKrwForPlan(plan: string, activeBrandCount = 1): number {
  const p = normalizePlanId(plan);
  if (p === 'premium') return premiumMonthlyPriceKrw(activeBrandCount);
  return MONTHLY_PRICE_KRW[p];
}

export function calculateBillingAmountKrw(
  plan: string,
  cycle: TenantBillingCycle,
  activeBrandCount = 1,
): number {
  const monthly = catalogMonthlyKrwForPlan(plan, activeBrandCount);
  if (cycle === 'MONTHLY') return monthly;
  return calculateAnnualFromMonthlyKrw(monthly);
}

export function calculateAnnualFromMonthlyKrw(monthlyKrw: number): number {
  return Math.round(monthlyKrw * 12 * (1 - TENANT_BILLING_ANNUAL_DISCOUNT_RATE));
}
