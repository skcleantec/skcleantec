import type { DbMarketplaceMaskedItem } from '../api/dbMarketplace';

/** 장바구니 — 일괄 게시 선택 가능 */
export function canBulkPublishMarketplaceItem(row: DbMarketplaceMaskedItem): boolean {
  return row.status === 'DRAFT' && row.role === 'SELLER';
}

/** 구매 가능 — 일괄 갖고가기 선택 가능 */
export function canBulkBuyMarketplaceItem(row: DbMarketplaceMaskedItem): boolean {
  return (
    row.status === 'OPEN' &&
    row.role === 'VIEWER' &&
    !row.platformSuspended &&
    (!row.holdActive || row.holdIsMine)
  );
}

export function marketplaceBulkSelectDisabledReason(row: DbMarketplaceMaskedItem, mode: 'publish' | 'buy'): string | null {
  if (mode === 'publish') {
    if (row.status !== 'DRAFT') return '장바구니(DRAFT)만 게시할 수 있습니다.';
    if (row.role !== 'SELLER') return '판매 건만 선택할 수 있습니다.';
    return null;
  }
  if (row.platformSuspended) return '플랫폼 중지된 건입니다.';
  if (row.status !== 'OPEN') return '게시 중인 건만 갖고갈 수 있습니다.';
  if (row.role !== 'VIEWER') return '구매 가능한 건만 선택할 수 있습니다.';
  if (row.holdActive && !row.holdIsMine) return '다른 업체가 검토 예약 중입니다.';
  return null;
}
