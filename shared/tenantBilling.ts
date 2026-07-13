/**
 * 테넌트 SaaS 과금 — 클라이언트·서버 공통 상수 (server는 tenantBilling.constants.ts 동기화)
 */
import type { TenantPlanId } from './tenantFeatureModules.js';
import { TENANT_PLAN_MONTHLY_PRICE_KRW } from './tenantPlanCatalog.js';

export const TENANT_TRIAL_DAYS = 7;
export const TENANT_PREPAID_SERVICE_DELAY_DAYS = 7;
/** 연간 선납 할인율 — 과금 전용 20% (플랜 카탈로그 UI 15%와 별도) */
export const TENANT_BILLING_ANNUAL_DISCOUNT_RATE = 0.2;
export const TENANT_BILLING_DEFAULT_GRACE_DAYS = 3;

export type TenantBillingCycle = 'MONTHLY' | 'ANNUAL';
export type TenantSuspendReason = 'TRIAL_EXPIRED' | 'BILLING_OVERDUE' | 'PLATFORM';
export type TenantInvoiceStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'OVERDUE' | 'VOID';

export const TENANT_BILLING_CYCLE_LABEL: Record<TenantBillingCycle, string> = {
  MONTHLY: '월납',
  ANNUAL: '연납',
};

export const TENANT_INVOICE_STATUS_LABEL: Record<TenantInvoiceStatus, string> = {
  DRAFT: '작성 중',
  ISSUED: '청구',
  PAID: '납부 완료',
  OVERDUE: '연체',
  VOID: '무효',
};

export function calculateBillingAmountKrw(plan: TenantPlanId, cycle: TenantBillingCycle): number {
  const monthly = TENANT_PLAN_MONTHLY_PRICE_KRW[plan];
  if (cycle === 'MONTHLY') return monthly;
  return Math.round(monthly * 12 * (1 - TENANT_BILLING_ANNUAL_DISCOUNT_RATE));
}

export function formatBillingAmountKrw(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원 (VAT 별도)`;
}

export function billingCyclePriceHint(plan: TenantPlanId, cycle: TenantBillingCycle): string {
  const amount = calculateBillingAmountKrw(plan, cycle);
  if (cycle === 'MONTHLY') {
    return `월 ${amount.toLocaleString('ko-KR')}원 (VAT 별도)`;
  }
  return `연 ${amount.toLocaleString('ko-KR')}원 (20% 할인, VAT 별도)`;
}
