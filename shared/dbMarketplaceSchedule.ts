/** 정보공유(장바구니·게시·인계·확정) 접수 — 스케줄 TO·슬롯 집계 제외용 */

export type DbMarketplaceListingSlotStatus =
  | 'DRAFT'
  | 'OPEN'
  | 'PENDING_SELLER'
  | 'CONFIRMED'
  | 'EXPIRED'
  | 'WITHDRAWN';

export type DbMarketplaceListingSlotMeta = {
  status: DbMarketplaceListingSlotStatus;
} | null | undefined;

/** WITHDRAWN 제외 — 정보공유에 올라간(또는 올라갔던) 접수는 자사 팀장 TO·슬롯에서 제외 */
export function inquiryExcludedFromInternalToByDbListing(
  dbListing: DbMarketplaceListingSlotMeta,
): boolean {
  if (!dbListing?.status) return false;
  return dbListing.status !== 'WITHDRAWN';
}
