import type { InquiryDbListingBuyerKind } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { isFeatureEnabled } from '../tenants/tenantFeatures.service.js';
import { createTenantInquiryShare, TenantInquiryShareError } from '../tenant-partners/tenantInquiryShare.service.js';
import { notifyInboxRefresh } from '../realtime/inboxNotify.js';
import { DbMarketplaceError } from './dbMarketplace.service.js';
import {
  assertBuyerCanViewListing,
  type DbMarketplaceBuyerContext,
} from './dbMarketplaceBuyerAccess.js';
import {
  notifyDbMarketplaceBuyerRequested,
  notifyDbMarketplaceConfirmed,
  notifyDbMarketplaceSellerDeclined,
} from './dbMarketplaceNotify.service.js';
import { expireStaleOpenDbListings } from './dbMarketplaceExpire.service.js';
import { invalidateExternalSettlementOverviewPayableCache } from '../external-companies/externalSettlementOverviewCache.js';
import {
  assertBuyerCanProceedPastHold,
  clearHoldData,
  releaseExpiredDbListingHolds,
} from './dbMarketplaceHold.service.js';
import { assertExternalCompanySelectable } from '../external-companies/externalCompanyUsage.helpers.js';

export type { DbMarketplaceBuyerContext } from './dbMarketplaceBuyerAccess.js';

export async function confirmDbListingBuyer(listingId: string, buyer: DbMarketplaceBuyerContext) {
  await expireStaleOpenDbListings();
  await releaseExpiredDbListingHolds();
  const now = new Date();

  const updated = await prisma.$transaction(async (tx) => {
    const listing = await tx.inquiryDbListing.findFirst({
      where: { id: listingId },
      include: { audiences: true },
    });
    if (!listing) throw new DbMarketplaceError('항목을 찾을 수 없습니다.', 404);
    if (listing.status !== 'OPEN') {
      throw new DbMarketplaceError('이미 다른 업체가 신청했거나 마감된 건입니다.', 409);
    }

    await assertBuyerCanViewListing(listing, buyer);
    assertBuyerCanProceedPastHold(listing, buyer, now);

    const buyerKind: InquiryDbListingBuyerKind =
      buyer.kind === 'PARTNER_TENANT' ? 'PARTNER_TENANT' : 'EXTERNAL_COMPANY';

    const result = await tx.inquiryDbListing.updateMany({
      where: { id: listingId, status: 'OPEN' },
      data: {
        status: 'PENDING_SELLER',
        buyerKind,
        buyerTenantId: buyer.kind === 'PARTNER_TENANT' ? buyer.tenantId : null,
        buyerExternalCompanyId: buyer.kind === 'EXTERNAL_COMPANY' ? buyer.externalCompanyId : null,
        buyerConfirmedAt: now,
        buyerConfirmedByUserId: buyer.userId,
        sellerConfirmedAt: null,
        sellerConfirmedByUserId: null,
        ...clearHoldData(),
      },
    });
    if (result.count !== 1) {
      throw new DbMarketplaceError('이미 다른 업체가 신청했습니다. 다시 확인해 주세요.', 409);
    }

    return tx.inquiryDbListing.findUniqueOrThrow({
      where: { id: listingId },
      include: {
        audiences: true,
        tenant: { select: { id: true, name: true } },
        buyerTenant: { select: { id: true, name: true } },
        buyerExternalCompany: { select: { id: true, name: true } },
      },
    });
  });

  await notifyDbMarketplaceBuyerRequested({
    sellerTenantId: updated.tenantId,
    visibility: updated.visibility,
    audiences: updated.audiences,
    buyerTenantId: updated.buyerTenantId,
    buyerExternalCompanyId: updated.buyerExternalCompanyId,
  });

  return updated;
}

async function resolvePartnershipId(sellerTenantId: string, buyerTenantId: string): Promise<string> {
  const partnership = await prisma.tenantPartnership.findFirst({
    where: {
      status: 'ACTIVE',
      OR: [
        { tenantLowId: sellerTenantId, tenantHighId: buyerTenantId },
        { tenantHighId: sellerTenantId, tenantLowId: buyerTenantId },
      ],
    },
    select: { id: true },
  });
  if (!partnership) throw new DbMarketplaceError('파트너 연결을 찾을 수 없습니다.', 400);
  return partnership.id;
}

async function assignExternalCompanyBuyer(opts: {
  tenantId: string;
  inquiryId: string;
  externalCompanyId: string;
  listingFee: number;
  assignedByUserId: string;
}) {
  try {
    await assertExternalCompanySelectable(prisma, opts.tenantId, opts.externalCompanyId);
  } catch (e) {
    throw new DbMarketplaceError(
      e instanceof Error ? e.message : '사용 중지된 타업체입니다.',
      400,
    );
  }
  const partnerUser = await prisma.user.findFirst({
    where: {
      tenantId: opts.tenantId,
      role: 'EXTERNAL_PARTNER',
      externalCompanyId: opts.externalCompanyId,
      isActive: true,
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!partnerUser) {
    throw new DbMarketplaceError('타업체 로그인 계정이 없습니다. 사용자 등록 후 인계해 주세요.', 400);
  }

  await prisma.$transaction(async (tx) => {
    const inquiry = await tx.inquiry.findFirst({
      where: { id: opts.inquiryId, tenantId: opts.tenantId },
      select: { id: true },
    });
    if (!inquiry) throw new DbMarketplaceError('접수를 찾을 수 없습니다.', 404);

    await tx.assignment.deleteMany({ where: { inquiryId: opts.inquiryId, tenantId: opts.tenantId } });
    await tx.assignment.create({
      data: {
        tenantId: opts.tenantId,
        inquiryId: opts.inquiryId,
        teamLeaderId: partnerUser.id,
        assignedById: opts.assignedByUserId,
        sortOrder: 0,
      },
    });
    await tx.inquiry.update({
      where: { id: opts.inquiryId, tenantId: opts.tenantId },
      data: { externalTransferFee: opts.listingFee },
    });
  });

  await notifyInboxRefresh([partnerUser.id]);
}

export async function confirmDbListingSeller(
  sellerTenantId: string,
  sellerUserId: string,
  listingId: string,
) {
  const listing = await prisma.inquiryDbListing.findFirst({
    where: { id: listingId, tenantId: sellerTenantId },
    include: {
      inquiry: { select: { id: true, tenantShareAsSource: { select: { id: true } } } },
    },
  });
  if (!listing) throw new DbMarketplaceError('판매 항목을 찾을 수 없습니다.', 404);
  if (listing.status !== 'PENDING_SELLER') {
    throw new DbMarketplaceError('인계 확정할 수 없는 상태입니다.', 400);
  }
  if (!listing.buyerConfirmedAt || !listing.buyerKind) {
    throw new DbMarketplaceError('구매자 확정이 필요합니다.', 400);
  }
  if (listing.inquiry.tenantShareAsSource) {
    throw new DbMarketplaceError('이미 파트너에 직접 연계된 접수입니다.', 400);
  }

  const now = new Date();
  let tenantInquiryShareId: string | null = null;
  let targetInquiryId: string | null = null;

  if (listing.buyerKind === 'PARTNER_TENANT') {
    if (!listing.buyerTenantId) throw new DbMarketplaceError('구매 파트너 정보가 없습니다.', 400);
    const exchangeOn = await isFeatureEnabled(sellerTenantId, 'mod_tenant_exchange');
    if (!exchangeOn) {
      throw new DbMarketplaceError('파트너 접수 연계 기능이 꺼져 있어 인계할 수 없습니다.', 403);
    }
    const partnershipId = await resolvePartnershipId(sellerTenantId, listing.buyerTenantId);
    try {
      const shareResult = await createTenantInquiryShare({
        viewerTenantId: sellerTenantId,
        viewerUserId: sellerUserId,
        inquiryId: listing.inquiryId,
        partnershipId,
        transferFee: listing.listingFee,
      });
      tenantInquiryShareId = shareResult.share.id;
      targetInquiryId = shareResult.targetInquiryId;
    } catch (e) {
      if (e instanceof TenantInquiryShareError) {
        throw new DbMarketplaceError(e.message, e.status);
      }
      throw e;
    }
  } else if (listing.buyerKind === 'EXTERNAL_COMPANY') {
    if (!listing.buyerExternalCompanyId) {
      throw new DbMarketplaceError('구매 타업체 정보가 없습니다.', 400);
    }
    await assignExternalCompanyBuyer({
      tenantId: sellerTenantId,
      inquiryId: listing.inquiryId,
      externalCompanyId: listing.buyerExternalCompanyId,
      listingFee: listing.listingFee,
      assignedByUserId: sellerUserId,
    });
  }

  const finalCount = await prisma.inquiryDbListing.updateMany({
    where: { id: listingId, tenantId: sellerTenantId, status: 'PENDING_SELLER' },
    data: {
      status: 'CONFIRMED',
      confirmedAt: now,
      sellerConfirmedAt: now,
      sellerConfirmedByUserId: sellerUserId,
      tenantInquiryShareId,
    },
  });
  if (finalCount.count !== 1) {
    throw new DbMarketplaceError('인계 확정에 실패했습니다. 상태를 확인해 주세요.', 409);
  }

  const confirmed = await prisma.inquiryDbListing.findUniqueOrThrow({
    where: { id: listingId },
    include: {
      tenant: { select: { id: true, name: true } },
      buyerTenant: { select: { id: true, name: true } },
      buyerExternalCompany: { select: { id: true, name: true } },
    },
  });

  await notifyDbMarketplaceConfirmed({
    sellerTenantId,
    buyerKind: listing.buyerKind,
    buyerTenantId: listing.buyerTenantId,
    buyerExternalCompanyId: listing.buyerExternalCompanyId,
  });

  const feeInquiry = await prisma.inquiry.findFirst({
    where: { id: listing.inquiryId, tenantId: sellerTenantId },
    select: { operatingCompanyId: true },
  });
  if (feeInquiry?.operatingCompanyId) {
    invalidateExternalSettlementOverviewPayableCache(sellerTenantId, feeInquiry.operatingCompanyId);
  }

  return { listing: confirmed, targetInquiryId };
}

export async function declineDbListingSeller(
  sellerTenantId: string,
  _sellerUserId: string,
  listingId: string,
) {
  const listing = await prisma.inquiryDbListing.findFirst({
    where: { id: listingId, tenantId: sellerTenantId },
    include: { audiences: true },
  });
  if (!listing) throw new DbMarketplaceError('판매 항목을 찾을 수 없습니다.', 404);
  if (listing.status !== 'PENDING_SELLER') {
    throw new DbMarketplaceError('구매 신청을 거절할 수 없는 상태입니다.', 400);
  }
  if (!listing.buyerConfirmedAt) {
    throw new DbMarketplaceError('구매자 확정이 필요합니다.', 400);
  }

  const buyerTenantId = listing.buyerTenantId;
  const buyerExternalCompanyId = listing.buyerExternalCompanyId;

  const updatedCount = await prisma.inquiryDbListing.updateMany({
    where: { id: listingId, tenantId: sellerTenantId, status: 'PENDING_SELLER' },
    data: {
      status: 'OPEN',
      buyerKind: null,
      buyerTenantId: null,
      buyerExternalCompanyId: null,
      buyerConfirmedAt: null,
      buyerConfirmedByUserId: null,
    },
  });
  if (updatedCount.count !== 1) {
    throw new DbMarketplaceError('거절 처리에 실패했습니다. 상태를 확인해 주세요.', 409);
  }

  const updated = await prisma.inquiryDbListing.findUniqueOrThrow({
    where: { id: listingId },
    include: {
      audiences: true,
      tenant: { select: { id: true, name: true } },
      buyerTenant: { select: { id: true, name: true } },
      buyerExternalCompany: { select: { id: true, name: true } },
    },
  });

  await notifyDbMarketplaceSellerDeclined({
    sellerTenantId,
    visibility: listing.visibility,
    audiences: listing.audiences,
    buyerTenantId,
    buyerExternalCompanyId,
  });

  return updated;
}
