import type { DbMarketplaceMaskedItem } from '../api/dbMarketplace';

export type DbMarketplaceBulkMode =
  | 'publish'
  | 'buy'
  | 'revert_cart'
  | 'remove_cart'
  | 'seller_confirm';

/** 장바구니 — 일괄 게시 선택 가능 */
export function canBulkPublishMarketplaceItem(row: DbMarketplaceMaskedItem): boolean {
  return row.status === 'DRAFT' && row.role === 'SELLER';
}

/** 장바구니 — 원상복귀(등록 취소) */
export function canBulkRemoveFromCartItem(row: DbMarketplaceMaskedItem): boolean {
  return row.status === 'DRAFT' && row.role === 'SELLER';
}

/** 구매 가능 — 일괄 갖고가기 선택 가능 */
export function canBulkBuyMarketplaceItem(row: DbMarketplaceMaskedItem): boolean {
  return row.status === 'OPEN' && row.role === 'VIEWER' && !row.platformSuspended;
}

/** 내 판매 — 게시 중 건 장바구니로 되돌리기 */
export function canBulkRevertToCartItem(row: DbMarketplaceMaskedItem): boolean {
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
    case 'remove_cart':
      return canBulkRemoveFromCartItem(row);
    case 'buy':
      return canBulkBuyMarketplaceItem(row);
    case 'revert_cart':
      return canBulkRevertToCartItem(row);
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
  if (mode === 'remove_cart') {
    if (row.status !== 'DRAFT') return '장바구니 항목만 원상복귀할 수 있습니다.';
    if (row.role !== 'SELLER') return '판매 건만 선택할 수 있습니다.';
    return null;
  }
  if (mode === 'buy') {
    if (row.platformSuspended) return '플랫폼 중지된 건입니다.';
    if (row.status !== 'OPEN') return '게시 중인 건만 구매신청할 수 있습니다.';
    if (row.role !== 'VIEWER') return '구매 가능한 건만 선택할 수 있습니다.';
    return null;
  }
  if (mode === 'revert_cart') {
    if (row.role !== 'SELLER') return '내 판매 건만 선택할 수 있습니다.';
    if (row.status !== 'OPEN') return '게시 중인 건만 장바구니로 되돌릴 수 있습니다.';
    return null;
  }
  if (mode === 'seller_confirm') {
    if (row.role !== 'SELLER') return '판매자(인계) 건만 선택할 수 있습니다.';
    if (row.status !== 'PENDING_SELLER') return '인계 대기 건만 선택할 수 있습니다.';
    return null;
  }
  return null;
}

const MY_SALES_NO_BUYER_LABEL = '구매 전 · 미인계';

/** 내 판매 — 인계업체별 그룹 */
export function groupMySalesByCompany(
  items: DbMarketplaceMaskedItem[],
): Array<{ label: string; items: DbMarketplaceMaskedItem[] }> {
  const groups = new Map<string, DbMarketplaceMaskedItem[]>();
  for (const item of items) {
    const label = item.buyerName?.trim() || MY_SALES_NO_BUYER_LABEL;
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(item);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => {
      if (a === MY_SALES_NO_BUYER_LABEL) return 1;
      if (b === MY_SALES_NO_BUYER_LABEL) return -1;
      return a.localeCompare(b, 'ko');
    })
    .map(([label, groupItems]) => ({ label, items: groupItems }));
}
