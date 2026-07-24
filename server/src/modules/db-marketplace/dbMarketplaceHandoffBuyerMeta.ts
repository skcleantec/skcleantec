import type { SerializedTenantInquiryShareMeta } from '../tenant-partners/tenantInquiryShare.service.js';
import { prisma } from '../../lib/prisma.js';
import { isFeatureEnabled } from '../tenants/tenantFeatures.service.js';

/** 정보공유 구매(인계) — 구매·시공 업체 접수 수정에 표시 */
export type MarketplaceHandoffBuyerMeta = {
  sellerTenantName: string;
  buyerTotalFee: number;
};

type ItemWithShare = {
  id: string;
  tenantShare?: SerializedTenantInquiryShareMeta | null;
};

function metaFromTargetShare(share: SerializedTenantInquiryShareMeta): MarketplaceHandoffBuyerMeta | null {
  if (share.role !== 'TARGET' || !share.viaMarketplace) return null;
  const fee = share.transferFee != null && Number.isFinite(share.transferFee) ? Math.trunc(share.transferFee) : 0;
  const seller = share.partnerName?.trim();
  if (!seller) return null;
  return { sellerTenantName: seller, buyerTotalFee: fee };
}

export async function attachMarketplaceHandoffBuyerMetaToInquiries<T extends ItemWithShare>(
  viewerTenantId: string,
  items: T[],
  options?: { viewerExternalCompanyId?: string | null },
): Promise<Array<T & { marketplaceHandoffAsBuyer: MarketplaceHandoffBuyerMeta | null }>> {
  if (items.length === 0) return [];

  const enabled = await isFeatureEnabled(viewerTenantId, 'mod_db_marketplace');
  if (!enabled) {
    return items.map((item) => ({ ...item, marketplaceHandoffAsBuyer: null }));
  }

  const fromShare = new Map<string, MarketplaceHandoffBuyerMeta>();
  const needListingIds: string[] = [];

  for (const item of items) {
    const share = item.tenantShare;
    if (share) {
      const meta = metaFromTargetShare(share);
      if (meta) {
        fromShare.set(item.id, meta);
        continue;
      }
    }
    needListingIds.push(item.id);
  }

  const listingMeta = new Map<string, MarketplaceHandoffBuyerMeta>();
  const viewerExternalCompanyId = options?.viewerExternalCompanyId?.trim() || null;
  if (viewerExternalCompanyId && needListingIds.length > 0) {
    const rows = await prisma.inquiryDbListing.findMany({
      where: {
        tenantId: viewerTenantId,
        inquiryId: { in: needListingIds },
        status: 'CONFIRMED',
        buyerKind: 'EXTERNAL_COMPANY',
        buyerExternalCompanyId: viewerExternalCompanyId,
      },
      select: {
        inquiryId: true,
        buyerTotalFee: true,
        listingFee: true,
        tenant: { select: { name: true } },
      },
    });
    for (const row of rows) {
      const fee =
        row.buyerTotalFee > 0
          ? Math.trunc(row.buyerTotalFee)
          : Math.max(0, Math.trunc(row.listingFee));
      const seller = row.tenant.name?.trim();
      if (!seller) continue;
      listingMeta.set(row.inquiryId, { sellerTenantName: seller, buyerTotalFee: fee });
    }
  }

  return items.map((item) => ({
    ...item,
    marketplaceHandoffAsBuyer: fromShare.get(item.id) ?? listingMeta.get(item.id) ?? null,
  }));
}

export async function attachMarketplaceHandoffBuyerMetaToInquiry<T extends ItemWithShare>(
  viewerTenantId: string,
  item: T,
  options?: { viewerExternalCompanyId?: string | null },
): Promise<T & { marketplaceHandoffAsBuyer: MarketplaceHandoffBuyerMeta | null }> {
  const [withMeta] = await attachMarketplaceHandoffBuyerMetaToInquiries(viewerTenantId, [item], options);
  return withMeta;
}
