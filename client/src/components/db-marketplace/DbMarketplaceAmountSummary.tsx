/** 정보공유 금액 요약 — UI 공통 (쉬운 말만 사용) */

export type MarketplaceAmountRow = {
  customerBalanceAmount?: number | null;
  displayAmount?: number | null;
  listingFee?: number;
  priorFeesTotal?: number;
  buyerTotalFee?: number;
};

export function resolveMarketplaceCustomerBalance(row: MarketplaceAmountRow): number | null {
  const v = row.customerBalanceAmount ?? row.displayAmount;
  return v != null && Number.isFinite(v) ? Math.round(v) : null;
}

export function resolveMarketplaceBuyerTotalFee(row: MarketplaceAmountRow): number {
  if (row.buyerTotalFee != null && Number.isFinite(row.buyerTotalFee)) {
    return Math.max(0, Math.round(row.buyerTotalFee));
  }
  const prior = row.priorFeesTotal ?? 0;
  const hop = row.listingFee ?? 0;
  return Math.max(0, Math.round(prior + hop));
}

export function resolveMarketplacePriorFees(row: MarketplaceAmountRow): number {
  if (row.priorFeesTotal != null && Number.isFinite(row.priorFeesTotal)) {
    return Math.max(0, Math.round(row.priorFeesTotal));
  }
  const total = resolveMarketplaceBuyerTotalFee(row);
  const hop = Math.max(0, Math.round(row.listingFee ?? 0));
  return Math.max(0, total - hop);
}

export function formatWon(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '-';
  return `${Math.round(n).toLocaleString('ko-KR')}원`;
}

export function DbMarketplaceAmountSummaryBlock({
  row,
  compact = false,
  showSellerFee = false,
}: {
  row: MarketplaceAmountRow;
  compact?: boolean;
  /** 판매 패널 — 이번 판매 수수료 라벨 표시 */
  showSellerFee?: boolean;
}) {
  const customerBalance = resolveMarketplaceCustomerBalance(row);
  const buyerTotalFee = resolveMarketplaceBuyerTotalFee(row);
  const priorFees = resolveMarketplacePriorFees(row);
  const sellerFee = Math.max(0, Math.round(row.listingFee ?? 0));
  const text = compact ? 'text-fluid-2xs' : 'text-[10px] sm:text-[11px]';

  return (
    <div className={`space-y-0.5 tabular-nums text-gray-700 ${text}`}>
      <p>
        <span className="text-gray-500">고객 현장 수금 </span>
        <span className="font-semibold text-slate-900">{formatWon(customerBalance)}</span>
      </p>
      {showSellerFee ? (
        <p>
          <span className="text-gray-500">이번 판매 수수료 </span>
          {formatWon(sellerFee)}
        </p>
      ) : null}
      {priorFees > 0 ? (
        <p>
          <span className="text-gray-500">앞선 판매 수수료 </span>
          {formatWon(priorFees)}
        </p>
      ) : null}
      <p>
        <span className="text-gray-500">구매자 부담 수수료 </span>
        <span className="font-semibold text-violet-900">{formatWon(buyerTotalFee)}</span>
        {priorFees > 0 ? (
          <span className="text-gray-500">
            {' '}
            (앞선 {formatWon(priorFees)} + 이번 {formatWon(sellerFee)})
          </span>
        ) : null}
      </p>
    </div>
  );
}
