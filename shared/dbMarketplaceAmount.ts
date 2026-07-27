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

/**
 * 정보공유·인계 mirror — 서비스 잔금 = 총액 − 예약금.
 * serviceBalanceAmount(dealBalance 스냅)는 레거시·수수료 차감 등으로 어긋날 수 있어 총액·예약금을 우선한다.
 */
export function computeMarketplaceServiceBalanceAmount(opts: {
  serviceTotalAmount: number | null | undefined;
  serviceDepositAmount: number | null | undefined;
  serviceBalanceAmount?: number | null | undefined;
}): number | null {
  const total = opts.serviceTotalAmount;
  if (total != null && Number.isFinite(Number(total))) {
    const deposit =
      opts.serviceDepositAmount != null && Number.isFinite(Number(opts.serviceDepositAmount))
        ? Math.max(0, Math.round(Number(opts.serviceDepositAmount)))
        : 0;
    return Math.max(0, Math.round(Number(total)) - deposit);
  }
  const balance = opts.serviceBalanceAmount;
  if (balance != null && Number.isFinite(Number(balance))) {
    const n = Math.round(Number(balance));
    return n > 0 ? n : null;
  }
  return null;
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

/** 정산·매출 UI — 판매 hop 0 (인계 확정 시 예약금+수수료) */
export const MARKETPLACE_REVENUE_LABEL_SELLER_INITIAL = '정보공유 예약금+수수료';

/** 정산·매출 UI — 재판매 판매 (수수료만) */
export const MARKETPLACE_REVENUE_LABEL_SELLER_RESALE = '정보공유 수수료';

/** 정산·매출 UI — 구매·시공 업체 (잔금−구매자 부담 수수료 총액) */
export const MARKETPLACE_REVENUE_LABEL_BUYER = '정보공유 잔금−수수료';

export type MarketplaceSellerRevenue = {
  amount: number;
  label: string;
  depositPart: number;
  feePart: number;
};

/** 판매 업체 매출 — hop 0: 예약금+listingFee, 재판매: listingFee만 (인계 확정 시점) */
export function computeMarketplaceSellerRevenue(opts: {
  hopIndex: number;
  serviceDepositAmount: number | null | undefined;
  listingFee: number;
}): MarketplaceSellerRevenue {
  const feePart = Math.max(0, Math.round(opts.listingFee));
  const depositPart =
    opts.hopIndex <= 0
      ? Math.max(
          0,
          opts.serviceDepositAmount != null && Number.isFinite(Number(opts.serviceDepositAmount))
            ? Math.round(Number(opts.serviceDepositAmount))
            : 0,
        )
      : 0;
  const label =
    opts.hopIndex <= 0 ? MARKETPLACE_REVENUE_LABEL_SELLER_INITIAL : MARKETPLACE_REVENUE_LABEL_SELLER_RESALE;
  return {
    amount: depositPart + feePart,
    label,
    depositPart,
    feePart,
  };
}

/** 구매·시공 업체 매출 — 고객 잔금 − 정보공유 수수료 총액 (수수료는 판매 업체에 지급) */
export function computeMarketplaceBuyerCompanyRevenue(opts: {
  serviceTotalAmount: number | null | undefined;
  serviceDepositAmount: number | null | undefined;
  serviceBalanceAmount?: number | null | undefined;
  buyerTotalFee: number;
}): number {
  const balance =
    computeMarketplaceServiceBalanceAmount({
      serviceTotalAmount: opts.serviceTotalAmount,
      serviceDepositAmount: opts.serviceDepositAmount,
      serviceBalanceAmount: opts.serviceBalanceAmount,
    }) ?? 0;
  const fee = Math.max(0, Math.round(opts.buyerTotalFee));
  return Math.max(0, balance - fee);
}

export function marketplaceSellerRevenueLabel(hopIndex: number): string {
  return hopIndex <= 0 ? MARKETPLACE_REVENUE_LABEL_SELLER_INITIAL : MARKETPLACE_REVENUE_LABEL_SELLER_RESALE;
}
