import type { InquiryDbListingBuyerKind } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { computeMarketplaceHoldUntil } from '../../lib/dbMarketplacePolicy.js';
import { DbMarketplaceError } from './dbMarketplace.service.js';
import {
  assertBuyerCanViewListing,
  type DbMarketplaceBuyerContext,
} from './dbMarketplaceBuyerAccess.js';
import { expireStaleOpenDbListings } from './dbMarketplaceExpire.service.js';
import {
  notifyDbMarketplaceHoldChanged,
} from './dbMarketplaceNotify.service.js';

export type DbListingHoldFields = {
  holdBuyerKind: InquiryDbListingBuyerKind | null;
  holdBuyerTenantId: string | null;
  holdBuyerExternalCompanyId: string | null;
  holdByUserId: string | null;
  heldUntil: Date | null;
};

export function isListingActivelyHeld(
  listing: Pick<DbListingHoldFields, 'heldUntil'>,
  now: Date = new Date(),
): boolean {
  return listing.heldUntil != null && listing.heldUntil > now;
}

export function holdMatchesBuyer(
  listing: DbListingHoldFields,
  buyer: DbMarketplaceBuyerContext,
  now: Date = new Date(),
): boolean {
  if (!isListingActivelyHeld(listing, now) || !listing.holdBuyerKind) return false;
  if (buyer.kind === 'PARTNER_TENANT') {
    return (
      listing.holdBuyerKind === 'PARTNER_TENANT' && listing.holdBuyerTenantId === buyer.tenantId
    );
  }
  return (
    listing.holdBuyerKind === 'EXTERNAL_COMPANY' &&
    listing.holdBuyerExternalCompanyId === buyer.externalCompanyId
  );
}

export function clearHoldData() {
  return {
    holdBuyerKind: null,
    holdBuyerTenantId: null,
    holdBuyerExternalCompanyId: null,
    holdByUserId: null,
    heldUntil: null,
  } as const;
}

/** heldUntil 경과 hold 필드 초기화 (OPEN만) */
export async function releaseExpiredDbListingHolds(): Promise<number> {
  const now = new Date();
  const expired = await prisma.inquiryDbListing.findMany({
    where: {
      status: 'OPEN',
      heldUntil: { lte: now },
      holdBuyerKind: { not: null },
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
  if (expired.length === 0) return 0;

  const ids = expired.map((r) => r.id);
  const result = await prisma.inquiryDbListing.updateMany({
    where: { id: { in: ids }, status: 'OPEN' },
    data: clearHoldData(),
  });

  for (const row of expired) {
    await notifyDbMarketplaceHoldChanged({
      sellerTenantId: row.tenantId,
      visibility: row.visibility,
      audiences: row.audiences,
      buyerTenantId: null,
      buyerExternalCompanyId: null,
      authorUserId: null,
    });
  }

  return result.count;
}

function holdUpdateWhere(
  listingId: string,
  buyer: DbMarketplaceBuyerContext,
  now: Date,
): {
  id: string;
  status: 'OPEN';
  OR: Array<Record<string, unknown>>;
} {
  const expiredOrEmpty = [{ heldUntil: null }, { heldUntil: { lte: now } }];
  if (buyer.kind === 'PARTNER_TENANT') {
    return {
      id: listingId,
      status: 'OPEN',
      OR: [
        ...expiredOrEmpty,
        { holdBuyerKind: 'PARTNER_TENANT', holdBuyerTenantId: buyer.tenantId },
      ],
    };
  }
  return {
    id: listingId,
    status: 'OPEN',
    OR: [
      ...expiredOrEmpty,
      {
        holdBuyerKind: 'EXTERNAL_COMPANY',
        holdBuyerExternalCompanyId: buyer.externalCompanyId,
      },
    ],
  };
}

export async function createDbListingHold(listingId: string, buyer: DbMarketplaceBuyerContext) {
  await expireStaleOpenDbListings();
  await releaseExpiredDbListingHolds();
  const now = new Date();
  const heldUntil = computeMarketplaceHoldUntil(now);

  const updated = await prisma.$transaction(async (tx) => {
    const listing = await tx.inquiryDbListing.findFirst({
      where: { id: listingId },
      include: { audiences: true },
    });
    if (!listing) throw new DbMarketplaceError('항목을 찾을 수 없습니다.', 404);
    if (listing.status !== 'OPEN') {
      throw new DbMarketplaceError('검토 예약할 수 없는 상태입니다.', 400);
    }
    if (listing.platformSuspendedAt) {
      throw new DbMarketplaceError('플랫폼에 의해 일시 중지된 건입니다.', 403);
    }

    await assertBuyerCanViewListing(listing, buyer);

    if (isListingActivelyHeld(listing, now) && !holdMatchesBuyer(listing, buyer, now)) {
      throw new DbMarketplaceError('다른 업체가 검토 예약 중입니다.', 409);
    }

    const buyerKind: InquiryDbListingBuyerKind =
      buyer.kind === 'PARTNER_TENANT' ? 'PARTNER_TENANT' : 'EXTERNAL_COMPANY';

    const result = await tx.inquiryDbListing.updateMany({
      where: holdUpdateWhere(listingId, buyer, now),
      data: {
        holdBuyerKind: buyerKind,
        holdBuyerTenantId: buyer.kind === 'PARTNER_TENANT' ? buyer.tenantId : null,
        holdBuyerExternalCompanyId:
          buyer.kind === 'EXTERNAL_COMPANY' ? buyer.externalCompanyId : null,
        holdByUserId: buyer.userId,
        heldUntil,
      },
    });
    if (result.count !== 1) {
      throw new DbMarketplaceError('검토 예약에 실패했습니다. 다시 시도해 주세요.', 409);
    }

    return tx.inquiryDbListing.findUniqueOrThrow({
      where: { id: listingId },
      include: {
        audiences: true,
        holdBuyerTenant: { select: { id: true, name: true } },
        holdBuyerExternalCompany: { select: { id: true, name: true } },
      },
    });
  });

  await notifyDbMarketplaceHoldChanged({
    sellerTenantId: updated.tenantId,
    visibility: updated.visibility,
    audiences: updated.audiences,
    buyerTenantId: updated.holdBuyerTenantId,
    buyerExternalCompanyId: updated.holdBuyerExternalCompanyId,
    authorUserId: buyer.userId,
  });

  return updated;
}

export async function releaseDbListingHold(listingId: string, buyer: DbMarketplaceBuyerContext) {
  await releaseExpiredDbListingHolds();
  const now = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    const listing = await tx.inquiryDbListing.findFirst({
      where: { id: listingId },
      include: { audiences: true },
    });
    if (!listing) throw new DbMarketplaceError('항목을 찾을 수 없습니다.', 404);
    if (listing.status !== 'OPEN') {
      throw new DbMarketplaceError('검토 예약을 해제할 수 없는 상태입니다.', 400);
    }
    if (!holdMatchesBuyer(listing, buyer, now)) {
      throw new DbMarketplaceError('본인 예약만 해제할 수 있습니다.', 403);
    }

    const result = await tx.inquiryDbListing.updateMany({
      where: {
        id: listingId,
        status: 'OPEN',
        holdBuyerKind: listing.holdBuyerKind,
        ...(buyer.kind === 'PARTNER_TENANT'
          ? { holdBuyerTenantId: buyer.tenantId }
          : { holdBuyerExternalCompanyId: buyer.externalCompanyId }),
      },
      data: clearHoldData(),
    });
    if (result.count !== 1) {
      throw new DbMarketplaceError('예약 해제에 실패했습니다.', 409);
    }

    return tx.inquiryDbListing.findUniqueOrThrow({
      where: { id: listingId },
      include: { audiences: true },
    });
  });

  await notifyDbMarketplaceHoldChanged({
    sellerTenantId: updated.tenantId,
    visibility: updated.visibility,
    audiences: updated.audiences,
    buyerTenantId: null,
    buyerExternalCompanyId: null,
    authorUserId: buyer.userId,
  });

  return updated;
}

export function assertBuyerCanProceedPastHold(
  listing: DbListingHoldFields,
  buyer: DbMarketplaceBuyerContext,
  now: Date = new Date(),
): void {
  if (!isListingActivelyHeld(listing, now)) return;
  if (!holdMatchesBuyer(listing, buyer, now)) {
    throw new DbMarketplaceError('다른 업체가 검토 예약 중입니다.', 409);
  }
}

export type MarketplaceHoldView = {
  holdActive: boolean;
  holdIsMine: boolean;
  heldUntil: string | null;
  holdBuyerName: string | null;
};

export function buildMarketplaceHoldView(input: {
  listing: DbListingHoldFields & {
    holdBuyerTenant?: { name: string } | null;
    holdBuyerExternalCompany?: { name: string } | null;
  };
  viewerRole: 'SELLER' | 'BUYER' | 'VIEWER';
  buyer?: DbMarketplaceBuyerContext | null;
  now?: Date;
}): MarketplaceHoldView {
  const now = input.now ?? new Date();
  const holdActive = isListingActivelyHeld(input.listing, now);
  const holdIsMine = input.buyer ? holdMatchesBuyer(input.listing, input.buyer, now) : false;
  const holdBuyerName =
    holdActive && input.viewerRole === 'SELLER'
      ? (input.listing.holdBuyerTenant?.name ??
        input.listing.holdBuyerExternalCompany?.name ??
        null)
      : null;

  return {
    holdActive,
    holdIsMine,
    heldUntil: holdActive ? (input.listing.heldUntil?.toISOString() ?? null) : null,
    holdBuyerName,
  };
}
