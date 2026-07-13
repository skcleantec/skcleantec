/**
 * @see shared/tenantBilling.ts — 동기화
 */
import type { TenantPlanId } from '../tenants/tenantFeatureCatalog.js';

const MONTHLY_PRICE_KRW: Record<TenantPlanId, number> = {
  starter: 100_000,
  standard: 250_000,
  premium: 400_000,
};

export const TENANT_TRIAL_DAYS = 7;
export const TENANT_PREPAID_SERVICE_DELAY_DAYS = 7;
export const TENANT_BILLING_ANNUAL_DISCOUNT_RATE = 0.2;
export const TENANT_BILLING_DEFAULT_GRACE_DAYS = 3;

export type TenantBillingCycle = 'MONTHLY' | 'ANNUAL';

export function calculateBillingAmountKrw(plan: string, cycle: TenantBillingCycle): number {
  const monthly =
    plan in MONTHLY_PRICE_KRW ? MONTHLY_PRICE_KRW[plan as TenantPlanId] : MONTHLY_PRICE_KRW.starter;
  if (cycle === 'MONTHLY') return monthly;
  return Math.round(monthly * 12 * (1 - TENANT_BILLING_ANNUAL_DISCOUNT_RATE));
}
