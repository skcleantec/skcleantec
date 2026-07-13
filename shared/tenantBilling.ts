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
export type TenantBillingPricingMode = 'CATALOG' | 'CUSTOM';
export type TenantBillingAdjustmentType = 'SKIP' | 'CUSTOM_AMOUNT' | 'DEFER_SHIFT' | 'DEFER_MERGE';
export type TenantInvoiceSource = 'AUTO' | 'MANUAL';

export type BillingScheduleItemStatus =
  | TenantInvoiceStatus
  | 'SCHEDULED'
  | 'SKIPPED'
  | 'DEFERRED';

export const TENANT_BILLING_DEFAULT_DUE_DAY = 25;

export const TENANT_BILLING_PRICING_MODE_LABEL: Record<TenantBillingPricingMode, string> = {
  CATALOG: '카탈로그',
  CUSTOM: '약정 금액',
};

export const TENANT_BILLING_ADJUSTMENT_TYPE_LABEL: Record<TenantBillingAdjustmentType, string> = {
  SKIP: '면제',
  CUSTOM_AMOUNT: '1회 금액 변경',
  DEFER_SHIFT: '이월 (일정 순연)',
  DEFER_MERGE: '이월 (다음 달 합산)',
};

export const TENANT_BILLING_SCHEDULE_STATUS_LABEL: Record<BillingScheduleItemStatus, string> = {
  DRAFT: '작성 중',
  ISSUED: '청구',
  PAID: '납부 완료',
  OVERDUE: '연체',
  VOID: '무효',
  SCHEDULED: '예정',
  SKIPPED: '면제',
  DEFERRED: '이월',
};

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
  return calculateAnnualFromMonthlyKrw(monthly);
}

/** 월 금액 → 연납 20% 할인 */
export function calculateAnnualFromMonthlyKrw(monthlyKrw: number): number {
  return Math.round(monthlyKrw * 12 * (1 - TENANT_BILLING_ANNUAL_DISCOUNT_RATE));
}

export function resolveContractAmountKrw(input: {
  plan: TenantPlanId;
  cycle: TenantBillingCycle;
  pricingMode: TenantBillingPricingMode;
  customMonthlyAmountKrw?: number | null;
  customAnnualAmountKrw?: number | null;
}): { amountKrw: number; catalogMonthlyKrw: number; catalogAnnualKrw: number } {
  const catalogMonthlyKrw = TENANT_PLAN_MONTHLY_PRICE_KRW[input.plan];
  const catalogAnnualKrw = calculateAnnualFromMonthlyKrw(catalogMonthlyKrw);
  if (input.pricingMode === 'CUSTOM') {
    const monthly = input.customMonthlyAmountKrw ?? catalogMonthlyKrw;
    const autoAnnual = calculateAnnualFromMonthlyKrw(monthly);
    const amountKrw =
      input.cycle === 'ANNUAL' ? (input.customAnnualAmountKrw ?? autoAnnual) : monthly;
    return { amountKrw, catalogMonthlyKrw, catalogAnnualKrw };
  }
  return {
    amountKrw: calculateBillingAmountKrw(input.plan, input.cycle),
    catalogMonthlyKrw,
    catalogAnnualKrw,
  };
}

export function formatBillingAmountKrw(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원 (VAT 별도)`;
}

export function billingCyclePriceHint(
  plan: TenantPlanId,
  cycle: TenantBillingCycle,
  custom?: { pricingMode?: TenantBillingPricingMode; customMonthlyAmountKrw?: number | null },
): string {
  const pricingMode = custom?.pricingMode ?? 'CATALOG';
  const { amountKrw, catalogMonthlyKrw } = resolveContractAmountKrw({
    plan,
    cycle,
    pricingMode,
    customMonthlyAmountKrw: custom?.customMonthlyAmountKrw,
  });
  if (pricingMode === 'CUSTOM' && custom?.customMonthlyAmountKrw != null) {
    if (cycle === 'MONTHLY') {
      return `월 ${amountKrw.toLocaleString('ko-KR')}원 (약정 · 카탈로그 ${catalogMonthlyKrw.toLocaleString('ko-KR')}원, VAT 별도)`;
    }
    return `연 ${amountKrw.toLocaleString('ko-KR')}원 (약정 · VAT 별도)`;
  }
  const amount = amountKrw;
  if (cycle === 'MONTHLY') {
    return `월 ${amount.toLocaleString('ko-KR')}원 (VAT 별도)`;
  }
  return `연 ${amount.toLocaleString('ko-KR')}원 (20% 할인, VAT 별도)`;
}
