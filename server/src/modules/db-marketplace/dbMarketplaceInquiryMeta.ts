import type { InquiryDbListingStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { isFeatureEnabled } from '../tenants/tenantFeatures.service.js';

export type SerializedDbListingMeta = {
  listingId: string;
  status: Exclude<InquiryDbListingStatus, 'WITHDRAWN'>;
};

export async function attachDbListingMetaToInquiries<T extends { id: string }>(
  viewerTenantId: string,
  items: T[],
): Promise<Array<T & { dbListing: SerializedDbListingMeta | null }>> {
  if (items.length === 0) return [];

  const enabled = await isFeatureEnabled(viewerTenantId, 'mod_db_marketplace');
  if (!enabled) {
    return items.map((item) => ({ ...item, dbListing: null }));
  }

  const ids = items.map((i) => i.id);
  const rows = await prisma.inquiryDbListing.findMany({
    where: {
      tenantId: viewerTenantId,
      inquiryId: { in: ids },
      status: { not: 'WITHDRAWN' },
    },
    select: { id: true, inquiryId: true, status: true },
  });

  const map = new Map<string, SerializedDbListingMeta>();
  for (const row of rows) {
    map.set(row.inquiryId, {
      listingId: row.id,
      status: row.status as SerializedDbListingMeta['status'],
    });
  }

  return items.map((item) => ({ ...item, dbListing: map.get(item.id) ?? null }));
}

export async function attachDbListingMetaToInquiry<T extends { id: string }>(
  viewerTenantId: string,
  item: T,
): Promise<T & { dbListing: SerializedDbListingMeta | null }> {
  const [withMeta] = await attachDbListingMetaToInquiries(viewerTenantId, [item]);
  return withMeta;
}
