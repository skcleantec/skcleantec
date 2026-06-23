import { randomUUID } from 'node:crypto';
import type {
  InquiryDbListingAudienceKind,
  InquiryDbListingMessageAuthorRole,
  InquiryDbListingStatus,
  InquiryDbListingVisibility,
} from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { DbMarketplaceError, viewerCanSeeListing } from './dbMarketplace.service.js';
import { notifyDbMarketplaceMessagePosted } from './dbMarketplaceNotify.service.js';

const MAX_BODY_LEN = 2000;
const MAX_MESSAGES = 200;

export type DbListingMessageViewer =
  | { kind: 'STAFF'; tenantId: string; userId: string }
  | { kind: 'EXTERNAL'; tenantId: string; userId: string; externalCompanyId: string };

export type DbListingMessageDto = {
  id: string;
  authorRole: InquiryDbListingMessageAuthorRole;
  authorName: string;
  authorTenantId: string;
  body: string;
  createdAt: string;
  canWrite: boolean;
};

type ListingRow = {
  id: string;
  tenantId: string;
  status: InquiryDbListingStatus;
  visibility: InquiryDbListingVisibility;
  platformSuspendedAt: Date | null;
  buyerTenantId: string | null;
  buyerExternalCompanyId: string | null;
  audiences: Array<{
    audienceKind: InquiryDbListingAudienceKind;
    partnerTenantId: string | null;
    externalCompanyId: string | null;
  }>;
};

async function loadListingRow(listingId: string): Promise<ListingRow> {
  const row = await prisma.inquiryDbListing.findFirst({
    where: { id: listingId },
    select: {
      id: true,
      tenantId: true,
      status: true,
      visibility: true,
      platformSuspendedAt: true,
      buyerTenantId: true,
      buyerExternalCompanyId: true,
      audiences: true,
    },
  });
  if (!row) throw new DbMarketplaceError('항목을 찾을 수 없습니다.', 404);
  return row;
}

function isAppliedBuyer(listing: ListingRow, viewer: DbListingMessageViewer): boolean {
  if (viewer.kind === 'EXTERNAL') {
    return listing.buyerExternalCompanyId === viewer.externalCompanyId;
  }
  return listing.buyerTenantId === viewer.tenantId;
}

async function assertCanReadMessages(listing: ListingRow, viewer: DbListingMessageViewer): Promise<void> {
  const isSeller = listing.tenantId === viewer.tenantId;
  const isBuyer = isAppliedBuyer(listing, viewer);
  if (listing.status === 'CONFIRMED') {
    if (isSeller || isBuyer) return;
    if (
      viewer.kind === 'EXTERNAL' &&
      listing.buyerExternalCompanyId === viewer.externalCompanyId
    ) {
      return;
    }
    throw new DbMarketplaceError('조회 권한이 없습니다.', 403);
  }
  if (listing.status === 'DRAFT' || listing.status === 'WITHDRAWN' || listing.status === 'EXPIRED') {
    throw new DbMarketplaceError('문의를 조회할 수 없는 상태입니다.', 400);
  }
  const canSee = await viewerCanSeeListing(viewer.tenantId, listing, {
    externalCompanyId: viewer.kind === 'EXTERNAL' ? viewer.externalCompanyId : null,
  });
  if (!canSee && !isSeller) {
    throw new DbMarketplaceError('조회 권한이 없습니다.', 403);
  }
}

function resolveAuthorRole(listing: ListingRow, viewer: DbListingMessageViewer): InquiryDbListingMessageAuthorRole {
  if (listing.tenantId === viewer.tenantId) return 'SELLER';
  return 'BUYER';
}

function canWriteMessages(listing: ListingRow, viewer: DbListingMessageViewer): boolean {
  if (listing.platformSuspendedAt) return false;
  if (listing.status === 'CONFIRMED') return false;
  if (listing.status === 'DRAFT' || listing.status === 'WITHDRAWN' || listing.status === 'EXPIRED') {
    return false;
  }
  const isSeller = listing.tenantId === viewer.tenantId;
  if (listing.status === 'OPEN') return true;
  if (listing.status === 'PENDING_SELLER') {
    if (isSeller) return true;
    return isAppliedBuyer(listing, viewer);
  }
  return false;
}

function parseBody(raw: unknown): string {
  if (typeof raw !== 'string') throw new DbMarketplaceError('문의 내용을 입력해 주세요.', 400);
  const body = raw.trim();
  if (body.length === 0) throw new DbMarketplaceError('문의 내용을 입력해 주세요.', 400);
  if (body.length > MAX_BODY_LEN) {
    throw new DbMarketplaceError(`문의는 ${MAX_BODY_LEN}자 이내로 입력해 주세요.`, 400);
  }
  return body;
}

export async function listDbListingMessages(
  viewer: DbListingMessageViewer,
  listingId: string,
): Promise<{ items: DbListingMessageDto[]; canWrite: boolean }> {
  const listing = await loadListingRow(listingId);
  await assertCanReadMessages(listing, viewer);
  const canWrite = canWriteMessages(listing, viewer);

  const rows = await prisma.inquiryDbListingMessage.findMany({
    where: { listingId },
    orderBy: { createdAt: 'asc' },
    take: MAX_MESSAGES,
    include: { author: { select: { id: true, name: true, tenantId: true } } },
  });

  return {
    canWrite,
    items: rows.map((row) => ({
      id: row.id,
      authorRole: row.authorRole,
      authorName: row.author.name,
      authorTenantId: row.author.tenantId,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
      canWrite,
    })),
  };
}

export async function postDbListingMessage(
  viewer: DbListingMessageViewer,
  listingId: string,
  bodyRaw: unknown,
): Promise<DbListingMessageDto> {
  const listing = await loadListingRow(listingId);
  await assertCanReadMessages(listing, viewer);
  if (!canWriteMessages(listing, viewer)) {
    throw new DbMarketplaceError('지금은 문의를 등록할 수 없습니다.', 400);
  }
  const body = parseBody(bodyRaw);
  const authorRole = resolveAuthorRole(listing, viewer);

  const row = await prisma.inquiryDbListingMessage.create({
    data: {
      id: randomUUID(),
      tenantId: viewer.tenantId,
      listingId,
      authorUserId: viewer.userId,
      authorRole,
      body,
    },
    include: { author: { select: { id: true, name: true, tenantId: true } } },
  });

  await notifyDbMarketplaceMessagePosted({
    sellerTenantId: listing.tenantId,
    visibility: listing.visibility,
    audiences: listing.audiences,
    buyerTenantId: listing.buyerTenantId,
    buyerExternalCompanyId: listing.buyerExternalCompanyId,
    authorUserId: viewer.userId,
  });

  return {
    id: row.id,
    authorRole: row.authorRole,
    authorName: row.author.name,
    authorTenantId: row.author.tenantId,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    canWrite: true,
  };
}
