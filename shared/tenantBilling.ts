/**
 * 테넌트 SaaS 과금 — 클라이언트·서버 공통 상수 (server는 tenantBilling.constants.ts 동기화)
 */
import type { TenantPlanId } from './tenantFeatureModules.js';
import { TENANT_PLAN_MONTHLY_PRICE_KRW } from './tenantPlanCatalog.js';

export const TENANT_TRIAL_DAYS = 7;
export const TENANT_PREPAID_SERVICE_DELAY_DAYS = 7;
/** 연간 선납 할인율 (플랜 카탈로그·과금 공통 15%) */
export const TENANT_BILLING_ANNUAL_DISCOUNT_RATE = 0.15;
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
  CATALOG: '표준금액',
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

/** 월 금액 → 연납 15% 할인 */
export function calculateAnnualFromMonthlyKrw(monthlyKrw: number): number {
  return Math.round(monthlyKrw * 12 * (1 - TENANT_BILLING_ANNUAL_DISCOUNT_RATE));
}

export type TenantBillingOperationalStatusCode =
  | 'TRIAL_PAID'
  | 'TRIAL_UNPAID'
  | 'PENDING_START'
  | 'ACTIVE_OK'
  | 'ACTIVE_BILLED'
  | 'ACTIVE_OVERDUE'
  | 'ACTIVE_BLOCKED'
  | 'SUSPENDED'
  | 'SETUP_REQUIRED';

export type TenantBillingOperationalStatus = {
  code: TenantBillingOperationalStatusCode;
  label: string;
  detail: string | null;
};

export function formatBillingAnchorDayLabel(billingStartIso: string | null): string | null {
  if (!billingStartIso) return null;
  const d = new Date(billingStartIso);
  const day = Number(
    d.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }).slice(8, 10),
  );
  return `매월 ${day}일 (과금 시작일 기준)`;
}
export function formatNextDueDateLabel(
  cycle: TenantBillingCycle,
  dueDateIso: string,
): string {
  const d = new Date(dueDateIso);
  if (cycle === 'ANNUAL') {
    return d.toLocaleDateString('ko-KR', {
      timeZone: 'Asia/Seoul',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }
  return d.toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'long',
    day: 'numeric',
  });
}

/** 신규 테넌트: 프로비저닝 시 prepaidConfirmedAt 자동 설정 기준일 */
export const TENANT_BILLING_LEGACY_PREPAID_CUTOFF_ISO = '2026-07-13T00:00:00.000Z';

export function needsLegacyPrepaidConfirm(input: {
  prepaidConfirmedAt: string | null;
  serviceStartedAt: string | null;
  createdAt: string;
}): boolean {
  if (input.prepaidConfirmedAt || input.serviceStartedAt) return false;
  return new Date(input.createdAt).getTime() < new Date(TENANT_BILLING_LEGACY_PREPAID_CUTOFF_ISO).getTime();
}

export function resolveTenantBillingOperationalStatus(input: {
  status: string;
  suspendReason: TenantSuspendReason | null;
  trialEndsAt: string | null;
  prepaidConfirmedAt: string | null;
  serviceStartedAt: string | null;
  billingStartDate: string | null;
  billingAccessBlockedAt: string | null;
  hasOpenInvoice: boolean;
  hasOverdueInvoice: boolean;
  now?: Date;
}): TenantBillingOperationalStatus {
  const now = input.now ?? new Date();
  const trialEndMs = input.trialEndsAt ? new Date(input.trialEndsAt).getTime() : null;
  const inTrial = trialEndMs != null && trialEndMs > now.getTime();

  if (input.status === 'SUSPENDED') {
    if (input.suspendReason === 'TRIAL_EXPIRED') {
      return { code: 'SUSPENDED', label: '중지', detail: '체험 만료·입금 미확인' };
    }
    if (input.suspendReason === 'BILLING_OVERDUE') {
      return { code: 'SUSPENDED', label: '중지', detail: '미납' };
    }
    return { code: 'SUSPENDED', label: '중지', detail: '플랫폼' };
  }

  if (input.billingAccessBlockedAt) {
    return { code: 'ACTIVE_BLOCKED', label: '미납 제한', detail: '업무 이용 제한 중' };
  }

  if (input.serviceStartedAt) {
    if (input.hasOverdueInvoice) {
      return { code: 'ACTIVE_OVERDUE', label: '연체', detail: '미납 청구 있음' };
    }
    if (input.hasOpenInvoice) {
      return { code: 'ACTIVE_BILLED', label: '청구·미납', detail: '납부 대기' };
    }
    return { code: 'ACTIVE_OK', label: '사용 중', detail: null };
  }

  if (input.prepaidConfirmedAt && inTrial) {
    return { code: 'TRIAL_PAID', label: '체험 중', detail: '7일 환불 가능 기간' };
  }

  if (!input.prepaidConfirmedAt && !input.serviceStartedAt) {
    return { code: 'TRIAL_UNPAID', label: '입금 대기', detail: '입금 확인 후 7일 체험 시작' };
  }

  if (!input.prepaidConfirmedAt && (input.status === 'TRIAL' || inTrial)) {
    return { code: 'TRIAL_UNPAID', label: '입금 대기', detail: '입금 확인 필요' };
  }

  if (input.prepaidConfirmedAt && trialEndMs != null && trialEndMs <= now.getTime()) {
    return { code: 'PENDING_START', label: '전환 대기', detail: '체험 종료·과금 시작 예정' };
  }

  if (!input.billingStartDate && !input.serviceStartedAt) {
    return { code: 'SETUP_REQUIRED', label: '과금 설정 필요', detail: '시작일·계약 설정' };
  }

  if (input.billingStartDate && !input.serviceStartedAt) {
    return { code: 'SETUP_REQUIRED', label: '과금 설정됨', detail: '서비스 시작 대기' };
  }

  return { code: 'ACTIVE_OK', label: '사용 중', detail: null };
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
      return `월 ${amountKrw.toLocaleString('ko-KR')}원 (약정 · 표준 ${catalogMonthlyKrw.toLocaleString('ko-KR')}원, VAT 별도)`;
    }
    return `연 ${amountKrw.toLocaleString('ko-KR')}원 (약정 · VAT 별도)`;
  }
  const amount = amountKrw;
  if (cycle === 'MONTHLY') {
    return `월 ${amount.toLocaleString('ko-KR')}원 (VAT 별도)`;
  }
  return `연 ${amount.toLocaleString('ko-KR')}원 (15% 할인, VAT 별도)`;
}
