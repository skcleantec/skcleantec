import { prisma } from '../../lib/prisma.js';
import { notifyDbMarketplaceBroadcast } from './dbMarketplaceNotify.service.js';

/** OPEN listing 중 expiresAt 경과분을 EXPIRED로 전환 (PENDING_SELLER는 유지) */
export async function expireStaleOpenDbListings(): Promise<number> {
  const now = new Date();
  const stale = await prisma.inquiryDbListing.findMany({
    where: {
      status: 'OPEN',
      expiresAt: { lte: now },
    },
    select: {
      id: true,
      tenantId: true,
      visibility: true,
      audiences: {
        select: {
          audienceKind: true,
          partnerTenantId: true,
          externalCompanyId: true,
        },
      },
    },
  });
  if (stale.length === 0) return 0;

  const ids = stale.map((r) => r.id);
  const result = await prisma.inquiryDbListing.updateMany({
    where: { id: { in: ids }, status: 'OPEN' },
    data: { status: 'EXPIRED', expiredAt: now },
  });

  for (const row of stale) {
    await notifyDbMarketplaceBroadcast({
      sellerTenantId: row.tenantId,
      visibility: row.visibility,
      audiences: row.audiences,
    });
  }

  return result.count;
}
