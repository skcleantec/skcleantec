/**
 * DB 마켓(정보공유) 금액 — 고객 현장 수금과 정보공유 수수료는 분리한다.
 * @see docs/DB_MARKETPLACE.md
 */

export type MarketplaceFeeAmounts = {
  /** 이번 판매자가 책정한 수수료 */
  listingFee: number;
  /** 앞선 판매(재판매 체인) 수수료 합 */
  priorFeesTotal: number;
  /** 구매자가 부담하는 정보공유 수수료 총액 */
  buyerTotalFee: number;
  /** 고객에게 현장에서 받을 잔금 (dealBalance 스냅샷) */
  customerBalanceAmount: number | null;
  /** 목록 강조용 — customerBalanceAmount 와 동일 (잔금−수수료 아님) */
  displayAmount: number | null;
};

export function parseListingFeeInput(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const n = Math.round(raw);
    return n >= 0 ? n : null;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.replace(/,/g, '').trim();
    if (!trimmed) return null;
    const n = Math.round(Number(trimmed));
    if (!Number.isFinite(n) || n < 0) return null;
    return n;
  }
  return null;
}

/** 재판매 시 앞선 판매에서 구매자가 부담했던 총 수수료 */
export function resolvePriorFeesTotalFromParent(
  parent: { buyerTotalFee?: number | null; listingFee: number } | null | undefined,
): number {
  if (!parent) return 0;
  if (parent.buyerTotalFee != null && Number.isFinite(parent.buyerTotalFee)) {
    return Math.max(0, Math.round(parent.buyerTotalFee));
  }
  return Math.max(0, Math.round(parent.listingFee));
}

export function computeMarketplaceFeeAmounts(opts: {
  listingFee: number;
  priorFeesTotal?: number;
  customerBalanceAmount: number | null | undefined;
}): MarketplaceFeeAmounts {
  const listingFee = Math.max(0, Math.round(opts.listingFee));
  const priorFeesTotal = Math.max(0, Math.round(opts.priorFeesTotal ?? 0));
  const buyerTotalFee = priorFeesTotal + listingFee;
  const rawBalance = opts.customerBalanceAmount;
  const customerBalanceAmount =
    rawBalance != null && Number.isFinite(rawBalance) && Math.round(rawBalance) > 0
      ? Math.round(rawBalance)
      : null;
  return {
    listingFee,
    priorFeesTotal,
    buyerTotalFee,
    customerBalanceAmount,
    displayAmount: customerBalanceAmount,
  };
}

/** @deprecated displayAmount = 고객 잔금. net(잔금−수수료) 계산은 사용하지 않는다. */
export function computeMarketplaceDisplayAmount(
  serviceBalanceAmount: number | null | undefined,
  _listingFee: number,
): number | null {
  if (serviceBalanceAmount == null || !Number.isFinite(serviceBalanceAmount)) return null;
  const balance = Math.round(serviceBalanceAmount);
  return balance > 0 ? balance : null;
}

export function assertPublishableMarketplaceAmounts(
  customerBalanceAmount: number | null,
  listingFee: number,
): void {
  if (customerBalanceAmount == null || !Number.isFinite(customerBalanceAmount)) {
    throw new Error('고객 잔금을 확인한 뒤 수수료를 입력해 주세요.');
  }
  if (Math.round(customerBalanceAmount) <= 0) {
    throw new Error('고객 잔금을 확인한 뒤 수수료를 입력해 주세요.');
  }
  if (!Number.isFinite(listingFee) || Math.round(listingFee) < 0) {
    throw new Error('수수료를 입력해 주세요.');
  }
}
