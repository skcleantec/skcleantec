/** 정보공유(장바구니·게시·인계·확정) 접수 — 스케줄 TO·슬롯 집계 제외용 */

export function inquiryExcludedFromInternalToByDbListing(
  dbListing: { status: string } | null | undefined,
): boolean {
  if (!dbListing?.status) return false;
  return dbListing.status !== 'WITHDRAWN';
}
