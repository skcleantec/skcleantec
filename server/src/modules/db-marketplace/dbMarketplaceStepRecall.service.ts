import type { InquiryDbListing, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import {
  computeSourceMirrorBalanceAmount,
  computeTargetMirrorBalanceAmount,
} from '../tenant-partners/tenantInquiryShareBalance.helpers.js';
import { stampTenantShareCancelFeeDirection } from '../tenant-partners/tenantPartnerSettlement.service.js';
import { invalidateExternalSettlementOverviewPayableCache } from '../external-companies/externalSettlementOverviewCache.js';
import { notifyInboxRefresh } from '../realtime/inboxNotify.js';
import { DbMarketplaceError } from './dbMarketplace.service.js';
import {
  activeStaffAdminMarketerUserIds,
  externalPartnerUserIds,
} from './dbMarketplaceNotify.service.js';
import { assertRootSellerCanRecall } from './dbMarketplaceChain.helpers.js';
import { reverseDbMarketplaceFeeLedgerInTx } from './dbMarketplaceFeeLedger.service.js';
import { appendDbMarketplaceEvent } from './dbMarketplaceHistory.service.js';

export type DbMarketplaceStepRecallMode = 'complete' | 'cart';

async function verifyActorPassword(userId: string, password: string): Promise<void> {
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  if (!dbUser) throw new DbMarketplaceError('사용자를 찾을 수 없습니다.', 401);
  const valid = await bcrypt.compare(password, dbUser.passwordHash);
  if (!valid) throw new DbMarketplaceError('비밀번호가 일치하지 않습니다.', 401);
}

async function applyMirrorBalanceForShareInTx(
  tx: Prisma.TransactionClient,
  share: { targetInquiryId: string; transferFee: number | null; syncStatus: string },
  source: {
    serviceTotalAmount: number | null;
    serviceDepositAmount: number | null;
    serviceBalanceAmount: number | null;
  },
) {
  if (share.syncStatus !== 'ACTIVE') {
    const restored = computeSourceMirrorBalanceAmount(source);
    if (restored != null) {
      await tx.inquiry.update({
        where: { id: share.targetInquiryId },
        data: { serviceBalanceAmount: restored },
      });
    }
    return;
  }
  const adjusted = computeTargetMirrorBalanceAmount({
    serviceTotalAmount: source.serviceTotalAmount,
    serviceDepositAmount: source.serviceDepositAmount,
    serviceBalanceAmount: source.serviceBalanceAmount,
    transferFee: share.transferFee,
  });
  if (adjusted != null) {
    await tx.inquiry.update({
      where: { id: share.targetInquiryId },
      data: { serviceBalanceAmount: adjusted },
    });
  }
}

async function undoPartnerBuyerForListingInTx(
  tx: Prisma.TransactionClient,
  opts: {
    listing: Pick<InquiryDbListing, 'inquiryId' | 'tenantId' | 'buyerTenantId'>;
    actorUserId: string;
    operatingCompanyId: string | null;
    customerName: string;
    now: Date;
    listingId: string;
    reverseFees: boolean;
  },
): Promise<string | null> {
  if (!opts.listing.buyerTenantId) return null;

  const share = await tx.tenantInquiryShare.findFirst({
    where: {
      sourceInquiryId: opts.listing.inquiryId,
      sourceTenantId: opts.listing.tenantId,
      syncStatus: 'ACTIVE',
    },
  });
  if (!share) return opts.listing.buyerTenantId;

  const targetInquiry = await tx.inquiry.findFirst({
    where: { id: share.targetInquiryId, tenantId: share.targetTenantId },
    select: { id: true, status: true },
  });
  if (targetInquiry?.status === 'COMPLETED') {
    throw new DbMarketplaceError('구매자 측 작업이 완료된 접수는 회수할 수 없습니다.', 400);
  }

  const source = await tx.inquiry.findFirst({
    where: { id: share.sourceInquiryId, tenantId: opts.listing.tenantId },
    select: {
      serviceTotalAmount: true,
      serviceDepositAmount: true,
      serviceBalanceAmount: true,
    },
  });
  if (!source) throw new DbMarketplaceError('원본 접수를 찾을 수 없습니다.', 404);

  await tx.tenantInquiryShare.update({
    where: { id: share.id },
    data: { syncStatus: 'REVOKED' },
  });
  await applyMirrorBalanceForShareInTx(tx, { ...share, syncStatus: 'REVOKED' }, source);

  if (targetInquiry) {
    await tx.inquiry.update({
      where: { id: targetInquiry.id },
      data: { status: 'CANCELLED' },
    });
    await stampTenantShareCancelFeeDirection(tx, targetInquiry.id);
  }

  if (opts.reverseFees) {
    await reverseDbMarketplaceFeeLedgerInTx(tx, {
      listingId: opts.listingId,
      customerName: opts.customerName,
      actorUserId: opts.actorUserId,
      operatingCompanyId: opts.operatingCompanyId,
      reversedAt: opts.now,
    });
  }

  return share.targetTenantId;
}

async function undoExternalBuyerForListingInTx(
  tx: Prisma.TransactionClient,
  opts: {
    listing: Pick<InquiryDbListing, 'inquiryId' | 'tenantId' | 'buyerExternalCompanyId'>;
    actorUserId: string;
    operatingCompanyId: string | null;
    customerName: string;
    now: Date;
    listingId: string;
    reverseFees: boolean;
  },
): Promise<string | null> {
  if (!opts.listing.buyerExternalCompanyId) return null;

  await tx.assignment.deleteMany({
    where: { inquiryId: opts.listing.inquiryId, tenantId: opts.listing.tenantId },
  });
  await tx.inquiry.update({
    where: { id: opts.listing.inquiryId, tenantId: opts.listing.tenantId },
    data: { externalTransferFee: null },
  });

  if (opts.reverseFees) {
    await reverseDbMarketplaceFeeLedgerInTx(tx, {
      listingId: opts.listingId,
      customerName: opts.customerName,
      actorUserId: opts.actorUserId,
      operatingCompanyId: opts.operatingCompanyId,
      reversedAt: opts.now,
    });
  }

  return opts.listing.buyerExternalCompanyId;
}

async function reverseDownstreamListingsInTx(
  tx: Prisma.TransactionClient,
  parentListingId: string,
  actorUserId: string,
  now: Date,
): Promise<void> {
  const children = await tx.inquiryDbListing.findMany({
    where: {
      parentListingId,
      status: { in: ['OPEN', 'PENDING_SELLER', 'CONFIRMED'] },
    },
    include: {
      inquiry: {
        select: {
          customerName: true,
          operatingCompanyId: true,
        },
      },
    },
  });

  for (const child of children) {
    await reverseDownstreamListingsInTx(tx, child.id, actorUserId, now);

    if (child.status === 'CONFIRMED') {
      if (child.buyerKind === 'PARTNER_TENANT') {
        await undoPartnerBuyerForListingInTx(tx, {
          listing: child,
          actorUserId,
          operatingCompanyId: child.inquiry.operatingCompanyId,
          customerName: child.inquiry.customerName,
          now,
          listingId: child.id,
          reverseFees: true,
        });
      } else if (child.buyerKind === 'EXTERNAL_COMPANY') {
        await undoExternalBuyerForListingInTx(tx, {
          listing: child,
          actorUserId,
          operatingCompanyId: child.inquiry.operatingCompanyId,
          customerName: child.inquiry.customerName,
          now,
          listingId: child.id,
          reverseFees: true,
        });
      }
      await tx.inquiryDbListing.update({
        where: { id: child.id },
        data: { supersededAt: now, status: 'WITHDRAWN' },
      });
      await appendDbMarketplaceEvent(tx, {
        tenantId: child.tenantId,
        listingId: child.id,
        eventType: 'DOWNSTREAM_REVERSED',
        hopIndex: child.hopIndex,
        actorUserId,
        payload: { parentListingId },
      });
    } else {
      await tx.inquiryDbListing.update({
        where: { id: child.id },
        data: {
          status: 'WITHDRAWN',
          supersededAt: now,
          buyerKind: null,
          buyerTenantId: null,
          buyerExternalCompanyId: null,
          buyerConfirmedAt: null,
          buyerConfirmedByUserId: null,
        },
      });
    }
  }
}

export async function stepRecallDbListing(opts: {
  sellerTenantId: string;
  sellerUserId: string;
  listingId: string;
  password: string;
  mode: DbMarketplaceStepRecallMode;
}) {
  await verifyActorPassword(opts.sellerUserId, opts.password);

  const listing = await prisma.inquiryDbListing.findFirst({
    where: { id: opts.listingId, tenantId: opts.sellerTenantId },
    include: {
      inquiry: {
        select: {
          id: true,
          customerName: true,
          status: true,
          operatingCompanyId: true,
        },
      },
      buyerTenant: { select: { id: true, name: true } },
      buyerExternalCompany: { select: { id: true, name: true } },
      rootTenant: { select: { id: true, name: true } },
    },
  });
  if (!listing) throw new DbMarketplaceError('판매 항목을 찾을 수 없습니다.', 404);
  if (listing.status !== 'CONFIRMED') {
    throw new DbMarketplaceError('확정 완료된 건만 회수할 수 있습니다.', 400);
  }
  if (!listing.buyerKind) {
    throw new DbMarketplaceError('구매자 정보가 없습니다.', 400);
  }
  if (listing.inquiry.status === 'CANCELLED' || listing.inquiry.status === 'COMPLETED') {
    throw new DbMarketplaceError('취소·완료된 접수는 회수할 수 없습니다.', 400);
  }

  if (listing.hopIndex === 0) {
    await assertRootSellerCanRecall(listing.id);
  }

  const notifyUserIds = new Set<string>();
  for (const id of await activeStaffAdminMarketerUserIds(opts.sellerTenantId)) notifyUserIds.add(id);

  let buyerTenantId: string | null = listing.buyerTenantId;
  let buyerExternalCompanyId: string | null = listing.buyerExternalCompanyId;
  const operatingCompanyId = listing.inquiry.operatingCompanyId;
  const customerName = listing.inquiry.customerName;
  const now = new Date();
  const isComplete = opts.mode === 'complete';
  const eventType = isComplete
    ? listing.hopIndex === 0
      ? 'COMPLETE_RECALL'
      : 'STEP_COMPLETE_RECALL'
    : listing.hopIndex === 0
      ? 'CART_RECALL'
      : 'STEP_CART_RECALL';

  await prisma.$transaction(async (tx) => {
    await reverseDownstreamListingsInTx(tx, listing.id, opts.sellerUserId, now);

    if (listing.buyerKind === 'PARTNER_TENANT') {
      buyerTenantId = await undoPartnerBuyerForListingInTx(tx, {
        listing,
        actorUserId: opts.sellerUserId,
        operatingCompanyId,
        customerName,
        now,
        listingId: listing.id,
        reverseFees: true,
      });
    } else {
      buyerExternalCompanyId = await undoExternalBuyerForListingInTx(tx, {
        listing,
        actorUserId: opts.sellerUserId,
        operatingCompanyId,
        customerName,
        now,
        listingId: listing.id,
        reverseFees: true,
      });
    }

    if (isComplete) {
      await tx.inquiryDbListing.delete({ where: { id: listing.id } });
    } else {
      await tx.inquiryDbListing.update({
        where: { id: listing.id },
        data: {
          status: 'DRAFT',
          buyerKind: null,
          buyerTenantId: null,
          buyerExternalCompanyId: null,
          buyerConfirmedAt: null,
          buyerConfirmedByUserId: null,
          sellerConfirmedAt: null,
          sellerConfirmedByUserId: null,
          confirmedAt: null,
          tenantInquiryShareId: null,
          publishedAt: null,
          expiresAt: null,
          expiredAt: null,
          withdrawnAt: null,
        },
      });
    }

    await appendDbMarketplaceEvent(tx, {
      tenantId: opts.sellerTenantId,
      listingId: listing.id,
      eventType,
      hopIndex: listing.hopIndex,
      actorUserId: opts.sellerUserId,
      payload: {
        mode: opts.mode,
        buyerKind: listing.buyerKind,
        rootTenantName: listing.rootTenant?.name ?? null,
      },
    });
  });

  if (buyerTenantId) {
    for (const id of await activeStaffAdminMarketerUserIds(buyerTenantId)) notifyUserIds.add(id);
  }
  if (buyerExternalCompanyId) {
    for (const id of await externalPartnerUserIds(opts.sellerTenantId, buyerExternalCompanyId)) {
      notifyUserIds.add(id);
    }
  }
  if (notifyUserIds.size > 0) await notifyInboxRefresh([...notifyUserIds]);

  if (operatingCompanyId && buyerExternalCompanyId) {
    invalidateExternalSettlementOverviewPayableCache(opts.sellerTenantId, operatingCompanyId);
  }

  const buyerLabel =
    listing.buyerKind === 'PARTNER_TENANT'
      ? (listing.buyerTenant?.name ?? null)
      : (listing.buyerExternalCompany?.name ?? null);

  return {
    inquiryId: listing.inquiryId,
    mode: opts.mode,
    hopIndex: listing.hopIndex,
    listingFee: listing.buyerTotalFee > 0 ? listing.buyerTotalFee : listing.listingFee,
    buyerLabel,
  };
}
