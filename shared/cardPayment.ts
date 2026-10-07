/** 카드결제 — 수수료·상태·방식 단일 소스 (부가세 포함 만분율) */

export const CARD_PAYMENT_MODULE_ID = 'mod_card_payment' as const;

/** 테넌트 적용 수수료 3.3% (부가세 포함) */
export const DEFAULT_TENANT_CARD_FEE_BPS = 330;

/** 서비스브릿지 ← PG 원가 2.6% (부가세 포함) */
export const DEFAULT_PLATFORM_CARD_COST_BPS = 260;

export const CARD_PAYMENT_METHODS = ['KEYIN', 'CUSTOMER_LINK'] as const;
export type CardPaymentMethod = (typeof CARD_PAYMENT_METHODS)[number];

/** 서비스브릿지 가맹 상품. 수기(구인증)와 앱카드(인증)는 키가 서로 다릅니다. */
export const WSPAY_MERCHANT_CHANNELS = ['KEYIN', 'APP_CARD'] as const;
export type WspayMerchantChannel = (typeof WSPAY_MERCHANT_CHANNELS)[number];

/** 주문번호 앞 4자리는 PG가 준 OID 그대로입니다. */
export function normalizeWspayOid(raw: string): string | null {
  const oid = raw.trim();
  if (!/^[A-Za-z0-9]{4}$/.test(oid)) return null;
  return oid;
}

export function buildWspayOrderId(oid: string, uniquePart: string): string | null {
  const prefix = normalizeWspayOid(oid);
  if (!prefix) return null;
  const rest = uniquePart.replace(/[^A-Za-z0-9]/g, '').slice(0, 28);
  if (!rest) return null;
  const orderId = `${prefix}${rest}`;
  return orderId.startsWith(prefix) ? orderId : null;
}

export const CARD_PAYMENT_STATUSES = [
  'DRAFT',
  'AWAITING_PG',
  'LINK_SENT',
  'APPROVED',
  'CANCELLED',
  'FAILED',
] as const;
export type CardPaymentStatus = (typeof CARD_PAYMENT_STATUSES)[number];

export const TENANT_PG_ONBOARDING_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'FORWARDED_TO_PG',
  'APPROVED',
  'REJECTED',
] as const;
export type TenantPgOnboardingStatus = (typeof TENANT_PG_ONBOARDING_STATUSES)[number];

export type CardPaymentFeeBreakdown = {
  amountWon: number;
  tenantFeeBps: number;
  platformCostBps: number;
  tenantFeeWon: number;
  platformCostWon: number;
  platformSpreadWon: number;
  tenantNetWon: number;
};

export function computeCardPaymentFees(
  amountWon: number,
  tenantFeeBps: number = DEFAULT_TENANT_CARD_FEE_BPS,
  platformCostBps: number = DEFAULT_PLATFORM_CARD_COST_BPS,
): CardPaymentFeeBreakdown {
  const amount = Math.max(0, Math.round(Number(amountWon) || 0));
  const tenantBps = clampBps(tenantFeeBps);
  const costBps = clampBps(platformCostBps);
  const tenantFeeWon = Math.round((amount * tenantBps) / 10_000);
  const platformCostWon = Math.round((amount * costBps) / 10_000);
  return {
    amountWon: amount,
    tenantFeeBps: tenantBps,
    platformCostBps: costBps,
    tenantFeeWon,
    platformCostWon,
    platformSpreadWon: tenantFeeWon - platformCostWon,
    tenantNetWon: amount - tenantFeeWon,
  };
}

export function defaultCardPaymentAmountWon(input: {
  serviceBalanceAmount?: number | null;
  serviceTotalAmount?: number | null;
  serviceDepositAmount?: number | null;
}): number {
  const balance = toWon(input.serviceBalanceAmount);
  if (balance > 0) return balance;
  const total = toWon(input.serviceTotalAmount);
  const deposit = toWon(input.serviceDepositAmount);
  if (total > 0 && total >= deposit) return total - deposit;
  return total;
}

export function formatWon(n: number): string {
  return `${Number(n || 0).toLocaleString('ko-KR')}원`;
}

export function formatFeeBps(bps: number): string {
  const pct = clampBps(bps) / 100;
  return `${pct.toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}%`;
}

export const CARD_PAYMENT_METHOD_LABEL: Record<CardPaymentMethod, string> = {
  KEYIN: '수기결재',
  CUSTOMER_LINK: '고객링크결재',
};

export const CARD_PAYMENT_STATUS_LABEL: Record<CardPaymentStatus, string> = {
  DRAFT: '작성중',
  AWAITING_PG: 'PG 대기',
  LINK_SENT: '링크 발송',
  APPROVED: '결재완료',
  CANCELLED: '취소',
  FAILED: '실패',
};

export const TENANT_PG_ONBOARDING_STATUS_LABEL: Record<TenantPgOnboardingStatus, string> = {
  DRAFT: '작성중',
  SUBMITTED: '신청 제출',
  FORWARDED_TO_PG: 'PG 전달',
  APPROVED: '개통',
  REJECTED: '반려',
};

function clampBps(n: number): number {
  const v = Math.round(Number(n) || 0);
  if (v < 0) return 0;
  if (v > 10_000) return 10_000;
  return v;
}

function toWon(n: number | null | undefined): number {
  const v = Math.round(Number(n) || 0);
  return v > 0 ? v : 0;
}
