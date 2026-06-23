/**
 * DB 마켓(정보공유) 표시 금액 — 구매 전 노출용 단일 금액.
 * @see docs/DB_MARKETPLACE.md
 */

export function computeMarketplaceDisplayAmount(
  serviceBalanceAmount: number | null | undefined,
  listingFee: number,
): number | null {
  if (serviceBalanceAmount == null || !Number.isFinite(serviceBalanceAmount)) return null;
  const fee = Number.isFinite(listingFee) ? Math.max(0, Math.round(listingFee)) : 0;
  const balance = Math.round(serviceBalanceAmount);
  const net = balance - fee;
  return net >= 0 ? net : null;
}

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
