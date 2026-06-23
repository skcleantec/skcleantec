import type { DbMarketplaceMaskedItem } from '../api/dbMarketplace';

export type DbMarketplaceBulkMode = 'publish' | 'buy' | 'withdraw' | 'seller_confirm';

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

/** 내 판매 — 게시 중 건 일괄 철회 */
export function canBulkWithdrawMarketplaceItem(row: DbMarketplaceMaskedItem): boolean {
  return row.status === 'OPEN' && row.role === 'SELLER';
}

/** 진행 중 — 판매자 인계 대기 건 일괄 확정·거절 */
export function canBulkSellerConfirmMarketplaceItem(row: DbMarketplaceMaskedItem): boolean {
  return row.status === 'PENDING_SELLER' && row.role === 'SELLER';
}

export function canBulkSelectMarketplaceItem(
  row: DbMarketplaceMaskedItem,
  mode: DbMarketplaceBulkMode,
): boolean {
  switch (mode) {
    case 'publish':
      return canBulkPublishMarketplaceItem(row);
    case 'buy':
      return canBulkBuyMarketplaceItem(row);
    case 'withdraw':
      return canBulkWithdrawMarketplaceItem(row);
    case 'seller_confirm':
      return canBulkSellerConfirmMarketplaceItem(row);
    default:
      return false;
  }
}

export function marketplaceBulkSelectDisabledReason(
  row: DbMarketplaceMaskedItem,
  mode: DbMarketplaceBulkMode,
): string | null {
  if (mode === 'publish') {
    if (row.status !== 'DRAFT') return '장바구니(DRAFT)만 게시할 수 있습니다.';
    if (row.role !== 'SELLER') return '판매 건만 선택할 수 있습니다.';
    return null;
  }
  if (mode === 'buy') {
    if (row.platformSuspended) return '플랫폼 중지된 건입니다.';
    if (row.status !== 'OPEN') return '게시 중인 건만 갖고갈 수 있습니다.';
    if (row.role !== 'VIEWER') return '구매 가능한 건만 선택할 수 있습니다.';
    if (row.holdActive && !row.holdIsMine) return '다른 업체가 검토 예약 중입니다.';
    return null;
  }
  if (mode === 'withdraw') {
    if (row.role !== 'SELLER') return '내 판매 건만 선택할 수 있습니다.';
    if (row.status !== 'OPEN') return '게시 중인 건만 철회할 수 있습니다.';
    return null;
  }
  if (mode === 'seller_confirm') {
    if (row.role !== 'SELLER') return '판매자(인계) 건만 선택할 수 있습니다.';
    if (row.status !== 'PENDING_SELLER') return '인계 대기 건만 선택할 수 있습니다.';
    return null;
  }
  return null;
}
