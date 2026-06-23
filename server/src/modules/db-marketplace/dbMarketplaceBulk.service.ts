import { DB_MARKETPLACE_BULK_MAX } from '../../lib/dbMarketplacePolicy.js';
import {
  notifyDbMarketplaceBroadcast,
  notifyDbMarketplaceSellerAdmins,
} from './dbMarketplaceNotify.service.js';
import { confirmDbListingBuyer } from './dbMarketplaceConfirm.service.js';
import {
  DbMarketplaceError,
  publishDbListing,
  updateDbListingAudience,
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
