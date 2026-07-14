import type { TenantSuspendReason } from '@prisma/client';

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

/** @see shared/tenantBilling.ts resolveTenantBillingOperationalStatus — 동기화 */
export function resolveTenantBillingOperationalStatus(input: {
  status: string;
  suspendReason: TenantSuspendReason | null;
  trialEndsAt: Date | string | null;
  prepaidConfirmedAt: Date | string | null;
  serviceStartedAt: Date | string | null;
  billingStartDate: Date | string | null;
  billingAccessBlockedAt: Date | string | null;
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

  if (!input.prepaidConfirmedAt && !input.serviceStartedAt) {
    return { code: 'TRIAL_UNPAID', label: '입금 대기', detail: '입금 확인 후 7일 체험 시작' };
  }

  if (input.prepaidConfirmedAt && inTrial) {
    return { code: 'TRIAL_PAID', label: '체험 중', detail: '7일 환불 가능 기간' };
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
