import type { InquiryDbListingStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { DbMarketplaceError } from './dbMarketplace.service.js';

const ACTIVE_CHILD_STATUSES: InquiryDbListingStatus[] = ['OPEN', 'PENDING_SELLER', 'CONFIRMED'];

export async function findActiveChildListing(parentListingId: string) {
  return prisma.inquiryDbListing.findFirst({
    where: {
      parentListingId,
      status: { in: ACTIVE_CHILD_STATUSES },
    },
    select: { id: true, status: true, hopIndex: true, tenantId: true },
  });
}

/** 최초업체(O) — 하위 재판매(OPEN/PENDING/CONFIRMED)가 있으면 회수 불가 */
export async function assertRootSellerCanRecall(listingId: string): Promise<void> {
  const child = await findActiveChildListing(listingId);
  if (child) {
    throw new DbMarketplaceError(
      '하위 업체에서 재판매가 진행·완료된 건은 최초 판매자가 회수할 수 없습니다.',
      400,
    );
  }
}

export async function findParentListingForResale(
  buyerTenantId: string,
  targetInquiryId: string,
): Promise<{
  id: string;
  tenantId: string;
  hopIndex: number;
  rootListingId: string | null;
  rootTenantId: string | null;
  dealBalanceAmount: number | null;
  listingFee: number;
  buyerTotalFee: number;
} | null> {
  const share = await prisma.tenantInquiryShare.findUnique({
    where: { targetInquiryId },
    select: {
      syncStatus: true,
      sourceTenantId: true,
      sourceInquiryId: true,
    },
  });
  if (!share || share.syncStatus !== 'ACTIVE') return null;

  return prisma.inquiryDbListing.findFirst({
    where: {
      inquiryId: share.sourceInquiryId,
      tenantId: share.sourceTenantId,
      status: 'CONFIRMED',
      buyerTenantId,
    },
    select: {
      id: true,
      tenantId: true,
      hopIndex: true,
      rootListingId: true,
      rootTenantId: true,
      dealBalanceAmount: true,
      listingFee: true,
      buyerTotalFee: true,
    },
  });
}

export function resolveRootListingId(
  parent: { id: string; rootListingId: string | null } | null,
  selfId: string,
): string {
  return parent?.rootListingId ?? parent?.id ?? selfId;
}

export function resolveRootTenantId(
  parent: { tenantId: string; rootTenantId: string | null } | null,
  sellerTenantId: string,
): string {
  return parent?.rootTenantId ?? parent?.tenantId ?? sellerTenantId;
}
