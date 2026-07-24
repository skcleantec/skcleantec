/** 정보공유 금액 — 총액 · 수수료 · 잔금 (항상 동일 라벨) */

import { computeMarketplaceServiceBalanceAmount } from '@shared/dbMarketplaceAmount';

export type MarketplaceAmountRow = {
  serviceTotalAmount?: number | null;
  serviceDepositAmount?: number | null;
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

/** 서비스 총액 — inquiry 총액 우선, 없으면 잔금+예약금 */
export function resolveMarketplaceServiceTotal(row: MarketplaceAmountRow): number | null {
  const total = row.serviceTotalAmount;
  if (total != null && Number.isFinite(total)) {
    return Math.max(0, Math.round(total));
  }
  const balance = resolveMarketplaceServiceBalance(row);
  const deposit =
    row.serviceDepositAmount != null && Number.isFinite(row.serviceDepositAmount)
      ? Math.max(0, Math.round(row.serviceDepositAmount))
      : 0;
  if (balance != null) return balance + deposit;
  return null;
}

/** 서비스 잔금 — 총액−예약금 우선 (정보공유 정책) */
export function resolveMarketplaceServiceBalance(row: MarketplaceAmountRow): number | null {
  return (
    computeMarketplaceServiceBalanceAmount({
      serviceTotalAmount: row.serviceTotalAmount,
      serviceDepositAmount: row.serviceDepositAmount,
      serviceBalanceAmount: row.customerBalanceAmount ?? row.displayAmount,
    }) ?? resolveMarketplaceCustomerBalance(row)
  );
}

export function formatWon(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '-';
  return `${Math.round(n).toLocaleString('ko-KR')}원`;
}

/** 서비스 예약금 */
export function resolveMarketplaceServiceDeposit(row: MarketplaceAmountRow): number | null {
  const deposit = row.serviceDepositAmount;
  if (deposit != null && Number.isFinite(deposit)) {
    return Math.max(0, Math.round(deposit));
  }
  const total = resolveMarketplaceServiceTotal(row);
  const balance = resolveMarketplaceServiceBalance(row);
  if (total != null && balance != null && total >= balance) {
    return Math.max(0, total - balance);
  }
  return null;
}

export function DbMarketplaceAmountSummaryBlock({
  row,
  compact = false,
}: {
  row: MarketplaceAmountRow;
  compact?: boolean;
  /** @deprecated 더 이상 사용하지 않음 */
  showSellerFee?: boolean;
}) {
  const total = resolveMarketplaceServiceTotal(row);
  const deposit = resolveMarketplaceServiceDeposit(row);
  const fee = resolveMarketplaceBuyerTotalFee(row);
  const balance = resolveMarketplaceServiceBalance(row);
  const priorFees = resolveMarketplacePriorFees(row);
  const text = compact ? 'text-fluid-2xs' : 'text-[10px] sm:text-[11px]';

  return (
    <div className={`space-y-0.5 tabular-nums text-gray-700 ${text}`}>
      <p>
        <span className="text-gray-500">총액 </span>
        <span className="font-semibold text-slate-900">{formatWon(total)}</span>
      </p>
      <p>
        <span className="text-gray-500">예약금 </span>
        <span className="font-semibold text-slate-800">{formatWon(deposit)}</span>
      </p>
      <p>
        <span className="text-gray-500">수수료 </span>
        <span className="font-semibold text-violet-900">{formatWon(fee)}</span>
        {priorFees > 0 ? (
          <span className="text-gray-500"> (앞선 판매 {formatWon(priorFees)} 포함)</span>
        ) : null}
      </p>
      <p>
        <span className="text-gray-500">잔금 </span>
        <span className="font-semibold text-slate-900">{formatWon(balance)}</span>
      </p>
    </div>
  );
}

/** 재판매 — 판매자(접수 수정)용 수수료 3줄 */
export function DbMarketplaceResaleFeeBreakdown({
  priorFeesTotal,
  listingFee,
  buyerTotalFee,
  compact = false,
  title = '수수료 청구 내역',
}: {
  priorFeesTotal: number;
  listingFee: number;
  buyerTotalFee: number;
  compact?: boolean;
  title?: string;
}) {
  const prior = Math.max(0, Math.round(priorFeesTotal));
  const hop = Math.max(0, Math.round(listingFee));
  const total = Math.max(0, Math.round(buyerTotalFee));
  const text = compact ? 'text-fluid-2xs' : 'text-[10px] sm:text-[11px]';

  return (
    <div className={`rounded-md border border-violet-200 bg-violet-50/60 p-2 space-y-0.5 tabular-nums ${text}`}>
      <p className="mb-1 font-semibold text-violet-950">{title}</p>
      <p>
        <span className="text-gray-600">본인이 사온 수수료 </span>
        <span className="font-semibold text-slate-900">{formatWon(prior)}</span>
      </p>
      <p>
        <span className="text-gray-600">본인이 추가할 수수료 </span>
        <span className="font-semibold text-violet-900">{formatWon(hop)}</span>
      </p>
      <p className="border-t border-violet-200/80 pt-0.5">
        <span className="text-gray-600">총 청구 수수료 </span>
        <span className="font-semibold text-violet-950">{formatWon(total)}</span>
      </p>
    </div>
  );
}
