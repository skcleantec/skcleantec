import bcrypt from 'bcryptjs';
import type { Prisma } from '@prisma/client';
import { computeMarketplaceDisplayAmount } from '../../lib/dbMarketplaceAmount.js';
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

const REFUND_MEMO_PREFIX = '정보공유 완전 회수 환불';

export type DbMarketplaceCompleteRecallResult = {
  inquiryId: string;
  refundDisplayAmount: number;
  listingFee: number;
  buyerLabel: string | null;
};

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

async function recordPartnerRecallRefundInTx(
  tx: Prisma.TransactionClient,
  opts: {
    sellerTenantId: string;
    buyerTenantId: string;
    partnershipId: string;
    displayAmount: number;
    customerName: string;
    actorUserId: string;
    paidAt: Date;
  },
) {
  const memo = `${REFUND_MEMO_PREFIX} (${opts.customerName})`;
  await tx.tenantPartnerSettlementPayment.create({
    data: {
      tenantId: opts.buyerTenantId,
      partnerTenantId: opts.sellerTenantId,
      partnershipId: opts.partnershipId,
      role: 'BUYER',
      amount: opts.displayAmount,
      memo,
      actorId: opts.actorUserId,
      paidAt: opts.paidAt,
    },
  });
  await tx.tenantPartnerSettlementPayment.create({
    data: {
      tenantId: opts.sellerTenantId,
      partnerTenantId: opts.buyerTenantId,
      partnershipId: opts.partnershipId,
      role: 'SELLER',
      amount: opts.displayAmount,
      memo,
      actorId: opts.actorUserId,
      paidAt: opts.paidAt,
    },
  });
}

async function recordExternalRecallRefundInTx(
  tx: Prisma.TransactionClient,
  opts: {
    externalCompanyId: string;
    operatingCompanyId: string;
    displayAmount: number;
    customerName: string;
    actorUserId: string;
    paidAt: Date;
  },
) {
  await tx.externalCompanySettlementPayment.create({
    data: {
      externalCompanyId: opts.externalCompanyId,
      operatingCompanyId: opts.operatingCompanyId,
      amount: opts.displayAmount,
      memo: `${REFUND_MEMO_PREFIX} (${opts.customerName})`,
      actorId: opts.actorUserId,
      paidAt: opts.paidAt,
    },
  });
}

export async function completeRecallDbListing(opts: {
  sellerTenantId: string;
  sellerUserId: string;
  listingId: string;
  password: string;
}): Promise<DbMarketplaceCompleteRecallResult> {
  await verifyActorPassword(opts.sellerUserId, opts.password);

  const listing = await prisma.inquiryDbListing.findFirst({
    where: { id: opts.listingId, tenantId: opts.sellerTenantId },
    include: {
      inquiry: {
        select: {
          id: true,
          tenantId: true,
          customerName: true,
          inquiryNumber: true,
          status: true,
          serviceBalanceAmount: true,
          operatingCompanyId: true,
        },
      },
      buyerTenant: { select: { id: true, name: true } },
      buyerExternalCompany: { select: { id: true, name: true } },
    },
  });
  if (!listing) throw new DbMarketplaceError('판매 항목을 찾을 수 없습니다.', 404);
  if (listing.status !== 'CONFIRMED') {
    throw new DbMarketplaceError('확정 완료된 건만 완전 회수할 수 있습니다.', 400);
  }
  if (!listing.buyerKind) {
    throw new DbMarketplaceError('구매자 정보가 없습니다.', 400);
  }

  const inquiryStatus = listing.inquiry.status;
  if (inquiryStatus === 'CANCELLED') {
    throw new DbMarketplaceError('취소된 접수는 회수할 수 없습니다.', 400);
  }
  if (inquiryStatus === 'COMPLETED') {
    throw new DbMarketplaceError('완료된 접수는 회수할 수 없습니다.', 400);
  }

  const refundDisplayAmount =
    listing.displayAmount ??
    computeMarketplaceDisplayAmount(listing.inquiry.serviceBalanceAmount, listing.listingFee);
  if (refundDisplayAmount == null || refundDisplayAmount <= 0) {
    throw new DbMarketplaceError('환불 금액을 계산할 수 없습니다.', 400);
  }

  const buyerLabel =
    listing.buyerKind === 'PARTNER_TENANT'
      ? (listing.buyerTenant?.name ?? null)
      : (listing.buyerExternalCompany?.name ?? null);

  const notifyUserIds = new Set<string>();
  for (const id of await activeStaffAdminMarketerUserIds(opts.sellerTenantId)) notifyUserIds.add(id);

  let buyerTenantId: string | null = listing.buyerTenantId;
  let buyerExternalCompanyId: string | null = listing.buyerExternalCompanyId;
  let operatingCompanyId: string | null = listing.inquiry.operatingCompanyId;

  await prisma.$transaction(async (tx) => {
    const now = new Date();
    const customerName = listing.inquiry.customerName;

    if (listing.buyerKind === 'PARTNER_TENANT') {
      if (!listing.buyerTenantId) throw new DbMarketplaceError('구매 파트너 정보가 없습니다.', 400);

      const share = await tx.tenantInquiryShare.findFirst({
        where: {
          sourceInquiryId: listing.inquiryId,
          sourceTenantId: opts.sellerTenantId,
          syncStatus: 'ACTIVE',
        },
        include: {
          partnership: {
            select: {
              id: true,
              tenantLow: { select: { id: true, name: true } },
              tenantHigh: { select: { id: true, name: true } },
            },
          },
        },
      });
      if (!share) {
        throw new DbMarketplaceError('활성 파트너 연계를 찾을 수 없습니다.', 400);
      }

      const targetInquiry = await tx.inquiry.findFirst({
        where: { id: share.targetInquiryId, tenantId: share.targetTenantId },
        select: { id: true, customerName: true, status: true },
      });
      if (!targetInquiry) {
        throw new DbMarketplaceError('구매자 접수를 찾을 수 없습니다.', 404);
      }
      if (targetInquiry.status === 'COMPLETED') {
        throw new DbMarketplaceError('구매자 측 작업이 완료된 접수는 회수할 수 없습니다.', 400);
      }

      buyerTenantId = share.targetTenantId;

      const source = await tx.inquiry.findFirst({
        where: { id: share.sourceInquiryId, tenantId: opts.sellerTenantId },
        select: {
          customerName: true,
          serviceTotalAmount: true,
          serviceDepositAmount: true,
          serviceBalanceAmount: true,
        },
      });
      if (!source) throw new DbMarketplaceError('원본 접수를 찾을 수 없습니다.', 404);

      const partnerName =
        share.partnership.tenantLow.id === opts.sellerTenantId
          ? share.partnership.tenantHigh.name
          : share.partnership.tenantLow.name;

      await tx.tenantInquiryShare.update({
        where: { id: share.id },
        data: { syncStatus: 'REVOKED' },
      });
      await applyMirrorBalanceForShareInTx(
        tx,
        { ...share, syncStatus: 'REVOKED' },
        source,
      );

      await tx.inquiry.update({
        where: { id: targetInquiry.id },
        data: { status: 'CANCELLED' },
      });
      await stampTenantShareCancelFeeDirection(tx, targetInquiry.id);

      await recordPartnerRecallRefundInTx(tx, {
        sellerTenantId: opts.sellerTenantId,
        buyerTenantId: share.targetTenantId,
        partnershipId: share.partnershipId,
        displayAmount: refundDisplayAmount,
        customerName,
        actorUserId: opts.sellerUserId,
        paidAt: now,
      });

      await tx.inquiryChangeLog.create({
        data: {
          inquiryId: share.sourceInquiryId,
          customerName: source.customerName,
          actorId: opts.sellerUserId,
          lines: [
            `[정보공유] ${partnerName}에 인계한 DB를 완전 회수했습니다. (환불 ${refundDisplayAmount.toLocaleString('ko-KR')}원)`,
          ],
        },
      });
      await tx.inquiryChangeLog.create({
        data: {
          inquiryId: targetInquiry.id,
          customerName: targetInquiry.customerName,
          actorId: null,
          lines: [
            `[정보공유] ${partnerName} 판매자가 DB를 완전 회수했습니다. 이 접수는 종료되었습니다.`,
          ],
        },
      });
    } else if (listing.buyerKind === 'EXTERNAL_COMPANY') {
      if (!listing.buyerExternalCompanyId) {
        throw new DbMarketplaceError('구매 타업체 정보가 없습니다.', 400);
      }
      if (!operatingCompanyId) {
        throw new DbMarketplaceError('운영사 정보가 없어 타업체 환불을 기록할 수 없습니다.', 400);
      }

      const companyName = listing.buyerExternalCompany?.name ?? '타업체';

      await tx.assignment.deleteMany({
        where: { inquiryId: listing.inquiryId, tenantId: opts.sellerTenantId },
      });
      await tx.inquiry.update({
        where: { id: listing.inquiryId, tenantId: opts.sellerTenantId },
        data: { externalTransferFee: null },
      });

      await recordExternalRecallRefundInTx(tx, {
        externalCompanyId: listing.buyerExternalCompanyId,
        operatingCompanyId,
        displayAmount: refundDisplayAmount,
        customerName,
        actorUserId: opts.sellerUserId,
        paidAt: now,
      });

      await tx.inquiryChangeLog.create({
        data: {
          inquiryId: listing.inquiryId,
          customerName,
          actorId: opts.sellerUserId,
          lines: [
            `[정보공유] ${companyName}에 인계한 DB를 완전 회수했습니다. (환불 ${refundDisplayAmount.toLocaleString('ko-KR')}원)`,
          ],
        },
      });
    }

    await tx.inquiryDbListing.delete({ where: { id: listing.id, tenantId: opts.sellerTenantId } });
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

  return {
    inquiryId: listing.inquiryId,
    refundDisplayAmount,
    listingFee: listing.listingFee,
    buyerLabel,
  };
}
