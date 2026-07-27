import type { InquiryDbListingOfferMode } from '@prisma/client';
import type { DbMarketplaceAudienceRef } from './dbMarketplaceNotify.service.js';
import {
  activeStaffAdminMarketerUserIds,
  externalPartnerUserIds,
  notifyDbMarketplaceSellerAdmins,
} from './dbMarketplaceNotify.service.js';
import { notifyInboxRefresh } from '../realtime/inboxNotify.js';
import { audienceRefFromRow, type PriorityAudienceRow } from './dbMarketplacePriority.helpers.js';

async function userIdsForAudience(
  sellerTenantId: string,
  audience: DbMarketplaceAudienceRef,
): Promise<string[]> {
  if (audience.audienceKind === 'PARTNER_TENANT' && audience.partnerTenantId) {
    return activeStaffAdminMarketerUserIds(audience.partnerTenantId);
  }
  if (audience.audienceKind === 'EXTERNAL_COMPANY' && audience.externalCompanyId) {
    return externalPartnerUserIds(sellerTenantId, audience.externalCompanyId);
  }
  return [];
}

/** 순위 노출 — 현재 순위 구매 후보만 갱신 */
export async function notifyDbMarketplacePriorityRank(opts: {
  sellerTenantId: string;
  audiences: PriorityAudienceRow[];
  rank: number;
}): Promise<void> {
  const row = opts.audiences.find((a) => a.priorityRank === opts.rank);
  if (!row) return;
  const userIds = new Set<string>();
  for (const id of await userIdsForAudience(opts.sellerTenantId, audienceRefFromRow(row))) {
    userIds.add(id);
  }
  for (const id of await activeStaffAdminMarketerUserIds(opts.sellerTenantId)) {
    userIds.add(id);
  }
  if (userIds.size > 0) await notifyInboxRefresh([...userIds]);
}

/** 3순위 소진 — 장바구니 복귀, 판매자만 */
export async function notifyDbMarketplacePriorityExhausted(sellerTenantId: string): Promise<void> {
  await notifyDbMarketplaceSellerAdmins(sellerTenantId);
}

export function isPriorityOfferMode(
  offerMode: InquiryDbListingOfferMode | null | undefined,
): boolean {
  return offerMode === 'PRIORITY';
}
