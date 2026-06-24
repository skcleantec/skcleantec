import { DB_MARKETPLACE_BULK_MAX } from '../../lib/dbMarketplacePolicy.js';
import {
  notifyDbMarketplaceBroadcast,
  notifyDbMarketplaceSellerAdmins,
} from './dbMarketplaceNotify.service.js';
import {
  confirmDbListingBuyer,
  confirmDbListingSeller,
  declineDbListingSeller,
} from './dbMarketplaceConfirm.service.js';
import {
  DbMarketplaceError,
  publishDbListing,
  removeDbListingFromCart,
  revertDbListingToCart,
  updateDbListingAudience,
  withdrawDbListing,
} from './dbMarketplace.service.js';
import type { DbMarketplaceBuyerContext } from './dbMarketplaceBuyerAccess.js';

export type DbMarketplaceBulkItemResult = {
  id: string;
  inquiryId?: string;
  sellerTenantName?: string;
  displayAmount?: number | null;
};

export type DbMarketplaceBulkFailed = {
  id: string;
  error: string;
};

export type DbMarketplaceBulkPublishResult = {
  published: DbMarketplaceBulkItemResult[];
  failed: DbMarketplaceBulkFailed[];
};

export type DbMarketplaceBulkBuyerConfirmResult = {
  requested: DbMarketplaceBulkItemResult[];
  failed: DbMarketplaceBulkFailed[];
};

export type DbMarketplaceBulkRevertToCartResult = {
  reverted: DbMarketplaceBulkItemResult[];
  failed: DbMarketplaceBulkFailed[];
};

export type DbMarketplaceBulkRemoveFromCartResult = {
  removed: Array<{ id: string; inquiryId: string }>;
  failed: DbMarketplaceBulkFailed[];
};

export type DbMarketplaceBulkWithdrawResult = {
  withdrawn: DbMarketplaceBulkItemResult[];
  failed: DbMarketplaceBulkFailed[];
};

export type DbMarketplaceBulkSellerConfirmResult = {
  confirmed: Array<DbMarketplaceBulkItemResult & { targetInquiryId: string | null }>;
  failed: DbMarketplaceBulkFailed[];
};

export type DbMarketplaceBulkSellerDeclineResult = {
  declined: DbMarketplaceBulkItemResult[];
  failed: DbMarketplaceBulkFailed[];
};

function parseListingIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    throw new DbMarketplaceError('listingIds 배열이 필요합니다.', 400);
  }
  const ids = [...new Set(raw.filter((id): id is string => typeof id === 'string' && id.trim().length > 0).map((id) => id.trim()))];
  if (ids.length === 0) {
    throw new DbMarketplaceError('게시할 항목을 1건 이상 선택해 주세요.', 400);
  }
  if (ids.length > DB_MARKETPLACE_BULK_MAX) {
    throw new DbMarketplaceError(`한 번에 최대 ${DB_MARKETPLACE_BULK_MAX}건까지 처리할 수 있습니다.`, 400);
  }
  return ids;
}

export async function bulkPublishDbListings(
  tenantId: string,
  listingIdsRaw: unknown,
  visibilityRaw: unknown,
  audiencesRaw: unknown,
): Promise<DbMarketplaceBulkPublishResult> {
  const listingIds = parseListingIds(listingIdsRaw);
  const published: DbMarketplaceBulkItemResult[] = [];
  const failed: DbMarketplaceBulkFailed[] = [];

  for (const id of listingIds) {
    try {
      const audienceRow = await updateDbListingAudience(tenantId, id, visibilityRaw, audiencesRaw);
      const row = await publishDbListing(tenantId, id);
      await notifyDbMarketplaceBroadcast({
        sellerTenantId: tenantId,
        visibility: row.visibility,
        audiences: row.audiences.length > 0 ? row.audiences : audienceRow.audiences,
      });
      published.push({
        id: row.id,
        inquiryId: row.inquiryId,
        displayAmount: row.displayAmount,
      });
    } catch (e) {
      failed.push({
        id,
        error: e instanceof DbMarketplaceError ? e.message : '게시 실패',
      });
    }
  }

  if (published.length > 0) {
    await notifyDbMarketplaceSellerAdmins(tenantId);
  }

  return { published, failed };
}

export async function bulkConfirmDbListingBuyer(
  listingIdsRaw: unknown,
  buyer: DbMarketplaceBuyerContext,
): Promise<DbMarketplaceBulkBuyerConfirmResult> {
  const listingIds = parseListingIds(listingIdsRaw);
  const requested: DbMarketplaceBulkItemResult[] = [];
  const failed: DbMarketplaceBulkFailed[] = [];

  for (const id of listingIds) {
    try {
      const row = await confirmDbListingBuyer(id, buyer);
      requested.push({
        id: row.id,
        inquiryId: row.inquiryId,
        sellerTenantName: row.tenant.name,
        displayAmount: row.displayAmount,
      });
    } catch (e) {
      failed.push({
        id,
        error: e instanceof DbMarketplaceError ? e.message : '구매 신청 실패',
      });
    }
  }

  return { requested, failed };
}

export async function bulkWithdrawDbListings(
  tenantId: string,
  listingIdsRaw: unknown,
): Promise<DbMarketplaceBulkWithdrawResult> {
  const listingIds = parseListingIds(listingIdsRaw);
  const withdrawn: DbMarketplaceBulkItemResult[] = [];
  const failed: DbMarketplaceBulkFailed[] = [];

  for (const id of listingIds) {
    try {
      const row = await withdrawDbListing(tenantId, id);
      await notifyDbMarketplaceBroadcast({
        sellerTenantId: tenantId,
        visibility: row.visibility,
        audiences: row.audiences,
      });
      withdrawn.push({
        id: row.id,
        inquiryId: row.inquiryId,
        displayAmount: row.displayAmount,
      });
    } catch (e) {
      failed.push({
        id,
        error: e instanceof DbMarketplaceError ? e.message : '게시 철회 실패',
      });
    }
  }

  if (withdrawn.length > 0) {
    await notifyDbMarketplaceSellerAdmins(tenantId);
  }

  return { withdrawn, failed };
}

export async function bulkRevertDbListingsToCart(
  tenantId: string,
  listingIdsRaw: unknown,
): Promise<DbMarketplaceBulkRevertToCartResult> {
  const listingIds = parseListingIds(listingIdsRaw);
  const reverted: DbMarketplaceBulkItemResult[] = [];
  const failed: DbMarketplaceBulkFailed[] = [];

  for (const id of listingIds) {
    try {
      const row = await revertDbListingToCart(tenantId, id);
      await notifyDbMarketplaceBroadcast({
        sellerTenantId: tenantId,
        visibility: row.visibility,
        audiences: row.audiences,
      });
      reverted.push({
        id: row.id,
        inquiryId: row.inquiryId,
        displayAmount: row.displayAmount,
      });
    } catch (e) {
      failed.push({
        id,
        error: e instanceof DbMarketplaceError ? e.message : '장바구니 되돌리기 실패',
      });
    }
  }

  if (reverted.length > 0) {
    await notifyDbMarketplaceSellerAdmins(tenantId);
  }

  return { reverted, failed };
}

export async function bulkRemoveDbListingsFromCart(
  tenantId: string,
  listingIdsRaw: unknown,
): Promise<DbMarketplaceBulkRemoveFromCartResult> {
  const listingIds = parseListingIds(listingIdsRaw);
  const removed: Array<{ id: string; inquiryId: string }> = [];
  const failed: DbMarketplaceBulkFailed[] = [];

  for (const id of listingIds) {
    try {
      const row = await removeDbListingFromCart(tenantId, id);
      removed.push(row);
    } catch (e) {
      failed.push({
        id,
        error: e instanceof DbMarketplaceError ? e.message : '원상복귀 실패',
      });
    }
  }

  if (removed.length > 0) {
    await notifyDbMarketplaceSellerAdmins(tenantId);
  }

  return { removed, failed };
}

export async function bulkConfirmDbListingSeller(
  tenantId: string,
  sellerUserId: string,
  listingIdsRaw: unknown,
): Promise<DbMarketplaceBulkSellerConfirmResult> {
  const listingIds = parseListingIds(listingIdsRaw);
  const confirmed: DbMarketplaceBulkSellerConfirmResult['confirmed'] = [];
  const failed: DbMarketplaceBulkFailed[] = [];

  for (const id of listingIds) {
    try {
      const result = await confirmDbListingSeller(tenantId, sellerUserId, id);
      confirmed.push({
        id: result.listing.id,
        inquiryId: result.listing.inquiryId,
        displayAmount: result.listing.displayAmount,
        targetInquiryId: result.targetInquiryId,
      });
    } catch (e) {
      failed.push({
        id,
        error: e instanceof DbMarketplaceError ? e.message : '인계 확정 실패',
      });
    }
  }

  if (confirmed.length > 0) {
    await notifyDbMarketplaceSellerAdmins(tenantId);
  }

  return { confirmed, failed };
}

export async function bulkDeclineDbListingSeller(
  tenantId: string,
  sellerUserId: string,
  listingIdsRaw: unknown,
): Promise<DbMarketplaceBulkSellerDeclineResult> {
  const listingIds = parseListingIds(listingIdsRaw);
  const declined: DbMarketplaceBulkItemResult[] = [];
  const failed: DbMarketplaceBulkFailed[] = [];

  for (const id of listingIds) {
    try {
      const row = await declineDbListingSeller(tenantId, sellerUserId, id);
      declined.push({
        id: row.id,
        inquiryId: row.inquiryId,
        displayAmount: row.displayAmount,
      });
    } catch (e) {
      failed.push({
        id,
        error: e instanceof DbMarketplaceError ? e.message : '구매 신청 거절 실패',
      });
    }
  }

  if (declined.length > 0) {
    await notifyDbMarketplaceSellerAdmins(tenantId);
  }

  return { declined, failed };
}
