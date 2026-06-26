/** 접수·발주서 스냅샷 + 추가결재·레거시 추가금 → 팀장이 고객에게 받을 금액(잔금+회사입금 추가) */

export function coerceInquiryWonAmount(v: unknown): number {
  if (v == null || v === '') return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

export function resolveCollectibleBaseBalance(
  serviceTotalAmount: number | null | undefined,
  serviceDepositAmount: number | null | undefined,
  serviceBalanceAmount: number | null | undefined,
): number | null {
  if (serviceBalanceAmount != null && Number.isFinite(Number(serviceBalanceAmount))) {
    return coerceInquiryWonAmount(serviceBalanceAmount);
  }
  const total = coerceInquiryWonAmount(serviceTotalAmount);
  const deposit = coerceInquiryWonAmount(serviceDepositAmount);
  if (total > 0 && deposit >= 0) return Math.max(0, total - deposit);
  return null;
}

export type InquiryCollectibleAmountSlice = {
  serviceTotalAmount?: number | null;
  serviceDepositAmount?: number | null;
  serviceBalanceAmount?: number | null;
  orderForm?: {
    totalAmount?: number | null;
    depositAmount?: number | null;
    balanceAmount?: number | null;
  } | null;
  extraCharges?: Array<{ amount: number }> | null;
  additionalReceipts?: Array<{ amount: number; settlementChannel?: string }> | null;
};

export function effectiveInquiryAmountFields(item: InquiryCollectibleAmountSlice) {
  return {
    total: item.serviceTotalAmount ?? item.orderForm?.totalAmount ?? null,
    deposit: item.serviceDepositAmount ?? item.orderForm?.depositAmount ?? null,
    balance: item.serviceBalanceAmount ?? item.orderForm?.balanceAmount ?? null,
  };
}

/**
 * 고객에게 받을 금액 = 서비스 잔금(총액−예약금) + 회사입금 추가결재 + 레거시 현장 추가금.
 * 현장결재(FIELD_RECEIVED) 추가결재는 이미 수금된 것으로 보아 합계에서 제외(InquirySettlementPanel과 동일).
 */
export function computeInquiryCollectibleAmount(item: InquiryCollectibleAmountSlice): number | null {
  const { total, deposit, balance } = effectiveInquiryAmountFields(item);
  const resolvedBaseBalance = resolveCollectibleBaseBalance(total, deposit, balance);
  const legacyExtraSum = (item.extraCharges ?? []).reduce(
    (s, x) => s + coerceInquiryWonAmount(x.amount),
    0,
  );
  const arcSumTotal = (item.additionalReceipts ?? []).reduce(
    (s, x) => s + coerceInquiryWonAmount(x.amount),
    0,
  );
  const arcCompanyDepositSum = (item.additionalReceipts ?? []).reduce(
    (s, x) =>
      s + (x.settlementChannel === 'COMPANY_DEPOSIT' ? coerceInquiryWonAmount(x.amount) : 0),
    0,
  );
  const hasCollectible =
    resolvedBaseBalance != null || arcSumTotal !== 0 || legacyExtraSum !== 0;
  if (!hasCollectible) return null;
  return (resolvedBaseBalance ?? 0) + arcCompanyDepositSum + legacyExtraSum;
}
