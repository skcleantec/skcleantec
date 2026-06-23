import { prisma } from '../../lib/prisma.js';
import {
  notifyDbMarketplaceBroadcast,
  notifyDbMarketplaceSellerAdmins,
} from './dbMarketplaceNotify.service.js';

export class PlatformDbMarketplaceError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = 'PlatformDbMarketplaceError';
  }
}

export type PlatformDbMarketplaceListItem = {
  id: string;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  status: string;
  listingFee: number;
  displayAmount: number | null;
  publishedAt: string | null;
  expiresAt: string | null;
  platformSuspendedAt: string | null;
  buyerKind: string | null;
  buyerTenantName: string | null;
  confirmedAt: string | null;
};

/** 플랫폼 — 고객 PII 없이 listing 메타만 */
export async function listDbMarketplaceForPlatform(opts?: {
  tenantId?: string;
  limit?: number;
}): Promise<PlatformDbMarketplaceListItem[]> {
  const limit = Math.min(Math.max(opts?.limit ?? 100, 1), 200);
  const rows = await prisma.inquiryDbListing.findMany({
    where: {
      status: { in: ['OPEN', 'PENDING_SELLER', 'CONFIRMED', 'EXPIRED'] },
      ...(opts?.tenantId ? { tenantId: opts.tenantId } : {}),
    },
    select: {
      id: true,
      tenantId: true,
      status: true,
      listingFee: true,
      displayAmount: true,
      publishedAt: true,
      expiresAt: true,
      platformSuspendedAt: true,
      buyerKind: true,
      confirmedAt: true,
      tenant: { select: { slug: true, name: true } },
      buyerTenant: { select: { name: true } },
    },
    orderBy: [{ updatedAt: 'desc' }],
    take: limit,
  });

  return rows.map((row) => ({
    id: row.id,
    tenantId: row.tenantId,
    tenantSlug: row.tenant.slug,
    tenantName: row.tenant.name,
    status: row.status,
    listingFee: row.listingFee,
    displayAmount: row.displayAmount,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    platformSuspendedAt: row.platformSuspendedAt?.toISOString() ?? null,
    buyerKind: row.buyerKind,
    buyerTenantName: row.buyerTenant?.name ?? null,
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
  }));
}

export async function platformSuspendDbListing(listingId: string): Promise<void> {
  const listing = await prisma.inquiryDbListing.findFirst({
    where: { id: listingId },
    include: { audiences: true },
  });
  if (!listing) throw new PlatformDbMarketplaceError('판매 항목을 찾을 수 없습니다.', 404);
  if (listing.status !== 'OPEN' && listing.status !== 'PENDING_SELLER') {
    throw new PlatformDbMarketplaceError('게시·인계 대기 중인 건만 중지할 수 있습니다.', 400);
  }
  if (listing.platformSuspendedAt) {
    throw new PlatformDbMarketplaceError('이미 플랫폼 중지된 건입니다.', 400);
  }

  const now = new Date();
  await prisma.inquiryDbListing.update({
    where: { id: listingId },
    data: { platformSuspendedAt: now },
  });

  await notifyDbMarketplaceBroadcast({
    sellerTenantId: listing.tenantId,
    visibility: listing.visibility,
    audiences: listing.audiences,
  });
}

export async function platformResumeDbListing(listingId: string): Promise<void> {
  const listing = await prisma.inquiryDbListing.findFirst({
    where: { id: listingId },
    include: { audiences: true },
  });
  if (!listing) throw new PlatformDbMarketplaceError('판매 항목을 찾을 수 없습니다.', 404);
  if (!listing.platformSuspendedAt) {
    throw new PlatformDbMarketplaceError('중지된 건이 아닙니다.', 400);
  }

  await prisma.inquiryDbListing.update({
    where: { id: listingId },
    data: { platformSuspendedAt: null },
  });

  await notifyDbMarketplaceBroadcast({
    sellerTenantId: listing.tenantId,
    visibility: listing.visibility,
    audiences: listing.audiences,
  });
  await notifyDbMarketplaceSellerAdmins(listing.tenantId);
}
