import type { DbMarketplaceMaskedItem } from '../api/dbMarketplace';

export type DbMarketplaceBulkMode =
  | 'publish'
  | 'buy'
  | 'revert_cart'
  | 'remove_cart'
  | 'seller_confirm';

/** 공유 준비 — 일괄 게시 선택 가능 */
export function canBulkPublishMarketplaceItem(row: DbMarketplaceMaskedItem): boolean {
  return row.status === 'DRAFT' && row.role === 'SELLER';
}

/** 공유 준비 — 원상복귀(등록 취소) */
export function canBulkRemoveFromCartItem(row: DbMarketplaceMaskedItem): boolean {
  return row.status === 'DRAFT' && row.role === 'SELLER';
}

/** 받을 목록 — 일괄 인수 신청 선택 가능 */
export function canBulkBuyMarketplaceItem(row: DbMarketplaceMaskedItem): boolean {
  return row.status === 'OPEN' && row.role === 'VIEWER' && !row.platformSuspended;
}

/** 순위 노출 — 현재 순위 인수 후보만 거절 가능 */
export function canBuyerDeclinePriorityMarketplaceItem(row: DbMarketplaceMaskedItem): boolean {
  return (
    canBulkBuyMarketplaceItem(row) &&
    row.offerMode === 'PRIORITY' &&
    row.currentPriorityRank != null
  );
}

/** 공유 중 — 공유 준비로 되돌리기 */
export function canBulkRevertToCartItem(row: DbMarketplaceMaskedItem): boolean {
  return row.status === 'OPEN' && row.role === 'SELLER';
}

/** 인계 대기 — 공유 측 일괄 확정·거절 */
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
    if (row.status !== 'DRAFT') return '공유 준비(DRAFT)만 게시할 수 있습니다.';
    if (row.role !== 'SELLER') return '공유 건만 선택할 수 있습니다.';
    return null;
  }
  if (mode === 'remove_cart') {
    if (row.status !== 'DRAFT') return '공유 준비 항목만 원상복귀할 수 있습니다.';
    if (row.role !== 'SELLER') return '공유 건만 선택할 수 있습니다.';
    return null;
  }
  if (mode === 'buy') {
    if (row.platformSuspended) return '플랫폼 중지된 건입니다.';
    if (row.status !== 'OPEN') return '공유 중인 건만 인수 신청할 수 있습니다.';
    if (row.role !== 'VIEWER') return '받을 목록 건만 선택할 수 있습니다.';
    return null;
  }
  if (mode === 'revert_cart') {
    if (row.role !== 'SELLER') return '공유 건만 선택할 수 있습니다.';
    if (row.status !== 'OPEN') return '공유 중인 건만 공유 준비로 되돌릴 수 있습니다.';
    return null;
  }
  if (mode === 'seller_confirm') {
    if (row.role !== 'SELLER') return '공유(인계) 건만 선택할 수 있습니다.';
    if (row.status !== 'PENDING_SELLER') return '인계 대기 건만 선택할 수 있습니다.';
    return null;
  }
  return null;
}

const MY_SALES_NO_BUYER_LABEL = '인수 전 · 미인계';

/** 공유 중 — 인수 업체별 그룹 */
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
