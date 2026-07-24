/**
 * @generated-sync from shared/dbMarketplaceAmount.ts — 직접 수정하지 마세요.
 * 변경: shared/dbMarketplaceAmount.ts 수정 후 동기화.
 */

export type MarketplaceFeeAmounts = {
  listingFee: number;
  priorFeesTotal: number;
  buyerTotalFee: number;
  customerBalanceAmount: number | null;
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
