import { randomUUID } from 'node:crypto';
import type {
  InquiryDbListingAudienceKind,
  InquiryDbListingBuyerKind,
  InquiryDbListingStatus,
  InquiryDbListingVisibility,
  Prisma,
} from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import {
  computeMarketplaceDisplayAmount,
  parseListingFeeInput,
} from '../../lib/dbMarketplaceAmount.js';
import {
  expireStaleOpenDbListings,
} from './dbMarketplaceExpire.service.js';
import { computeMarketplaceExpiresAt } from '../../lib/dbMarketplacePolicy.js';
import {
  buildMaskedListingDto,
  buildFullInquiryDto,
  INQUIRY_FULL_SELECT,
  INQUIRY_MASK_SELECT,
  listingStatusSortRank,
  type MarketplaceListingDetailDto,
} from './dbMarketplaceListing.dto.js';

export class DbMarketplaceError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'DbMarketplaceError';
  }
}

const LISTING_INCLUDE = {
  inquiry: { select: INQUIRY_MASK_SELECT },
  tenant: { select: { id: true, name: true } },
  audiences: true,
} as const;

export type DbMarketplaceListTab = 'available' | 'my_sales' | 'pending' | 'confirmed';

function parseTab(raw: unknown): DbMarketplaceListTab {
  if (raw === 'my_sales' || raw === 'pending' || raw === 'confirmed') return raw;
  return 'available';
}

async function findInquiryForSeller(tenantId: string, inquiryId: string) {
  const inquiry = await prisma.inquiry.findFirst({
    where: { id: inquiryId, tenantId },
    select: {
      id: true,
      tenantId: true,
      serviceBalanceAmount: true,
      status: true,
      tenantShareAsSource: { select: { id: true } },
      dbListing: { select: { id: true, status: true } },
    },
  });
  if (!inquiry) throw new DbMarketplaceError('접수를 찾을 수 없습니다.', 404);
  if (inquiry.tenantShareAsSource) {
    throw new DbMarketplaceError('이미 파트너에 직접 연계된 접수는 마켓에 올릴 수 없습니다.', 400);
  }
  return inquiry;
}

function assertPublishableBalance(inquiry: { serviceBalanceAmount: number | null }, listingFee: number) {
  const display = computeMarketplaceDisplayAmount(inquiry.serviceBalanceAmount, listingFee);
  if (display == null) {
    throw new DbMarketplaceError('잔금을 확인한 뒤 수수료를 입력해 주세요.', 400);
  }
}

type AudienceInput = {
  audienceKind: InquiryDbListingAudienceKind;
  partnerTenantId?: string | null;
  externalCompanyId?: string | null;
};

function normalizeAudiences(raw: unknown): AudienceInput[] {
  if (!Array.isArray(raw)) return [];
  const out: AudienceInput[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const kind = (row as { audienceKind?: unknown }).audienceKind;
    if (kind !== 'PARTNER_TENANT' && kind !== 'EXTERNAL_COMPANY') continue;
    const partnerTenantId =
      typeof (row as { partnerTenantId?: unknown }).partnerTenantId === 'string'
        ? (row as { partnerTenantId: string }).partnerTenantId.trim()
        : null;
    const externalCompanyId =
      typeof (row as { externalCompanyId?: unknown }).externalCompanyId === 'string'
        ? (row as { externalCompanyId: string }).externalCompanyId.trim()
        : null;
    if (kind === 'PARTNER_TENANT' && partnerTenantId) {
      out.push({ audienceKind: kind, partnerTenantId, externalCompanyId: null });
    } else if (kind === 'EXTERNAL_COMPANY' && externalCompanyId) {
      out.push({ audienceKind: kind, partnerTenantId: null, externalCompanyId });
    }
  }
  return out;
}

export async function upsertDbListingDraft(
  tenantId: string,
  inquiryId: string,
  listingFeeRaw: unknown,
) {
  const listingFee = parseListingFeeInput(listingFeeRaw);
  if (listingFee == null) throw new DbMarketplaceError('수수료를 입력해 주세요.', 400);

  const inquiry = await findInquiryForSeller(tenantId, inquiryId);
  assertPublishableBalance(inquiry, listingFee);

  const existing = inquiry.dbListing;
  if (
    existing &&
    existing.status !== 'DRAFT' &&
    existing.status !== 'WITHDRAWN' &&
    existing.status !== 'EXPIRED'
  ) {
    throw new DbMarketplaceError('이미 게시 중이거나 확정된 건은 장바구니를 수정할 수 없습니다.', 400);
  }

  const displayAmount = computeMarketplaceDisplayAmount(inquiry.serviceBalanceAmount, listingFee);

  if (existing) {
    return prisma.inquiryDbListing.update({
      where: { id: existing.id, tenantId },
      data: {
        listingFee,
        displayAmount,
        status: 'DRAFT',
        withdrawnAt: null,
      },
      include: LISTING_INCLUDE,
    });
  }

  return prisma.inquiryDbListing.create({
    data: {
      id: randomUUID(),
      tenantId,
      inquiryId,
      listingFee,
      displayAmount,
      status: 'DRAFT',
    },
    include: LISTING_INCLUDE,
  });
}

export async function updateDbListingAudience(
  tenantId: string,
  listingId: string,
  visibilityRaw: unknown,
  audiencesRaw: unknown,
) {
  const listing = await prisma.inquiryDbListing.findFirst({
    where: { id: listingId, tenantId },
  });
  if (!listing) throw new DbMarketplaceError('판매 항목을 찾을 수 없습니다.', 404);
  if (
    listing.status !== 'DRAFT' &&
    listing.status !== 'OPEN' &&
    listing.status !== 'WITHDRAWN' &&
    listing.status !== 'EXPIRED'
  ) {
    throw new DbMarketplaceError('진행 중인 건은 노출 대상을 변경할 수 없습니다.', 400);
  }

  const visibility: InquiryDbListingVisibility =
    visibilityRaw === 'SELECTED' ? 'SELECTED' : 'ALL';
  const audiences = normalizeAudiences(audiencesRaw);

  if (visibility === 'SELECTED' && audiences.length === 0) {
    throw new DbMarketplaceError('노출할 업체를 1곳 이상 선택해 주세요.', 400);
  }

  if (visibility === 'SELECTED') {
    for (const a of audiences) {
      if (a.audienceKind === 'EXTERNAL_COMPANY' && a.externalCompanyId) {
        const ext = await prisma.externalCompany.findFirst({
          where: { id: a.externalCompanyId, tenantId, isActive: true },
        });
        if (!ext) throw new DbMarketplaceError('타업체를 찾을 수 없습니다.', 400);
      }
      if (a.audienceKind === 'PARTNER_TENANT' && a.partnerTenantId) {
        if (a.partnerTenantId === tenantId) {
          throw new DbMarketplaceError('자사는 노출 대상에 넣을 수 없습니다.', 400);
        }
        const partnerOk = await prisma.tenantPartnership.findFirst({
          where: {
            status: 'ACTIVE',
            OR: [
              { tenantLowId: tenantId, tenantHighId: a.partnerTenantId },
              { tenantHighId: tenantId, tenantLowId: a.partnerTenantId },
            ],
          },
        });
        if (!partnerOk) throw new DbMarketplaceError('연결된 파트너만 선택할 수 있습니다.', 400);
      }
    }
  }

  return prisma.$transaction(async (tx) => {
    await tx.inquiryDbListingAudience.deleteMany({ where: { listingId } });
    if (visibility === 'SELECTED') {
      await tx.inquiryDbListingAudience.createMany({
        data: audiences.map((a) => ({
          id: randomUUID(),
          listingId,
          audienceKind: a.audienceKind,
          partnerTenantId: a.partnerTenantId ?? null,
          externalCompanyId: a.externalCompanyId ?? null,
        })),
      });
    }
    return tx.inquiryDbListing.update({
      where: { id: listingId, tenantId },
      data: { visibility },
      include: LISTING_INCLUDE,
    });
  });
}

export async function publishDbListing(tenantId: string, listingId: string) {
  const listing = await prisma.inquiryDbListing.findFirst({
    where: { id: listingId, tenantId },
    include: { inquiry: { select: { serviceBalanceAmount: true } } },
  });
  if (!listing) throw new DbMarketplaceError('판매 항목을 찾을 수 없습니다.', 404);
  if (listing.status !== 'DRAFT' && listing.status !== 'WITHDRAWN' && listing.status !== 'EXPIRED') {
    throw new DbMarketplaceError('게시할 수 없는 상태입니다.', 400);
  }

  assertPublishableBalance(listing.inquiry, listing.listingFee);
  const displayAmount = computeMarketplaceDisplayAmount(
    listing.inquiry.serviceBalanceAmount,
    listing.listingFee,
  );

  if (listing.visibility === 'SELECTED') {
    const count = await prisma.inquiryDbListingAudience.count({ where: { listingId } });
    if (count === 0) throw new DbMarketplaceError('노출 대상을 선택해 주세요.', 400);
  }

  const now = new Date();
  return prisma.inquiryDbListing.update({
    where: { id: listingId, tenantId },
    data: {
      status: 'OPEN',
      displayAmount,
      publishedAt: now,
      withdrawnAt: null,
      expiredAt: null,
      expiresAt: computeMarketplaceExpiresAt(now),
      platformSuspendedAt: null,
    },
    include: LISTING_INCLUDE,
  });
}

export async function withdrawDbListing(tenantId: string, listingId: string) {
  const listing = await prisma.inquiryDbListing.findFirst({
    where: { id: listingId, tenantId },
  });
  if (!listing) throw new DbMarketplaceError('판매 항목을 찾을 수 없습니다.', 404);
  if (listing.status !== 'OPEN') {
    throw new DbMarketplaceError('게시 중인 건만 철회할 수 있습니다.', 400);
  }

  return prisma.inquiryDbListing.update({
    where: { id: listingId, tenantId },
    data: {
      status: 'WITHDRAWN',
      withdrawnAt: new Date(),
    },
    include: LISTING_INCLUDE,
  });
}

export async function countDbListingDrafts(tenantId: string): Promise<number> {
  return prisma.inquiryDbListing.count({
    where: { tenantId, status: 'DRAFT' },
  });
}

export async function countDbListingPendingSeller(tenantId: string): Promise<number> {
  return prisma.inquiryDbListing.count({
    where: { tenantId, status: 'PENDING_SELLER' },
  });
}

async function viewerCanSeeListing(
  tenantId: string,
  listing: {
    tenantId: string;
    status: InquiryDbListingStatus;
    visibility: InquiryDbListingVisibility;
    platformSuspendedAt?: Date | null;
    buyerTenantId?: string | null;
    buyerExternalCompanyId?: string | null;
    audiences: Array<{
      audienceKind: InquiryDbListingAudienceKind;
      partnerTenantId: string | null;
      externalCompanyId: string | null;
    }>;
  },
  opts?: { externalCompanyId?: string | null },
): Promise<boolean> {
  if (listing.tenantId === tenantId) {
    if (opts?.externalCompanyId) {
      if (listing.status !== 'OPEN' && listing.status !== 'PENDING_SELLER' && listing.status !== 'CONFIRMED') {
        return false;
      }
      if (listing.buyerExternalCompanyId && listing.buyerExternalCompanyId !== opts.externalCompanyId) {
        if (listing.status === 'PENDING_SELLER' || listing.status === 'CONFIRMED') return false;
      }
      if (listing.visibility === 'ALL') {
        if (listing.status === 'OPEN' && listing.platformSuspendedAt) return false;
        return listing.status === 'OPEN' || listing.status === 'PENDING_SELLER' || listing.status === 'CONFIRMED';
      }
      return listing.audiences.some(
        (a) => a.audienceKind === 'EXTERNAL_COMPANY' && a.externalCompanyId === opts.externalCompanyId,
      );
    }
    return true;
  }
  if (listing.buyerTenantId === tenantId && (listing.status === 'PENDING_SELLER' || listing.status === 'CONFIRMED')) {
    return true;
  }
  if (listing.status !== 'OPEN' && listing.status !== 'PENDING_SELLER') return false;
  if (listing.status === 'OPEN' && listing.platformSuspendedAt) return false;
  if (listing.visibility === 'ALL') return true;
  for (const a of listing.audiences) {
    if (a.audienceKind === 'PARTNER_TENANT' && a.partnerTenantId === tenantId) return true;
  }
  return false;
}

function resolveListRole(
  tenantId: string,
  listing: { tenantId: string; buyerTenantId: string | null },
): 'SELLER' | 'BUYER' | 'VIEWER' {
  if (listing.tenantId === tenantId) return 'SELLER';
  if (listing.buyerTenantId === tenantId) return 'BUYER';
  return 'VIEWER';
}

function resolveListRoleForViewer(
  tenantId: string,
  listing: {
    tenantId: string;
    buyerTenantId: string | null;
    buyerKind: InquiryDbListingBuyerKind | null;
    buyerExternalCompanyId: string | null;
  },
  opts?: { externalCompanyId?: string | null },
): 'SELLER' | 'BUYER' | 'VIEWER' {
  if (
    opts?.externalCompanyId &&
    listing.tenantId === tenantId &&
    listing.buyerKind === 'EXTERNAL_COMPANY' &&
    listing.buyerExternalCompanyId === opts.externalCompanyId
  ) {
    return 'BUYER';
  }
  return resolveListRole(tenantId, listing);
}

function buildExternalPartnerListWhere(
  tenantId: string,
  tab: DbMarketplaceListTab,
  externalCompanyId: string,
): Prisma.InquiryDbListingWhereInput {
  const visibilityOr: Prisma.InquiryDbListingWhereInput[] = [
    { visibility: 'ALL' },
    {
      visibility: 'SELECTED',
      audiences: { some: { externalCompanyId } },
    },
  ];
  switch (tab) {
    case 'pending':
      return { tenantId, status: 'PENDING_SELLER', buyerExternalCompanyId: externalCompanyId };
    case 'confirmed':
      return { tenantId, status: 'CONFIRMED', buyerExternalCompanyId: externalCompanyId };
    case 'available':
    default:
      return {
        tenantId,
        status: { in: ['OPEN', 'PENDING_SELLER'] },
        OR: visibilityOr,
      };
  }
}

function buildListWhere(
  tenantId: string,
  tab: DbMarketplaceListTab,
): Prisma.InquiryDbListingWhereInput {
  switch (tab) {
    case 'my_sales':
      return { tenantId };
    case 'pending':
      return {
        OR: [
          { tenantId, status: 'PENDING_SELLER' },
          { buyerTenantId: tenantId, status: 'PENDING_SELLER' },
        ],
      };
    case 'confirmed':
      return {
        OR: [
          { tenantId, status: 'CONFIRMED' },
          { buyerTenantId: tenantId, status: 'CONFIRMED' },
        ],
      };
    case 'available':
    default:
      return {
        tenantId: { not: tenantId },
        status: { in: ['OPEN', 'PENDING_SELLER'] },
        OR: [
          { visibility: 'ALL' },
          {
            visibility: 'SELECTED',
            audiences: { some: { partnerTenantId: tenantId } },
          },
        ],
      };
  }
}

export async function listDbMarketplaceListings(
  tenantId: string,
  tabRaw: unknown,
  limitRaw: unknown,
  offsetRaw: unknown,
  opts?: { viewerExternalCompanyId?: string | null },
) {
  await expireStaleOpenDbListings();
  const tab = parseTab(tabRaw);
  const limit = Math.min(Math.max(Number(limitRaw) || 30, 1), 100);
  const offset = Math.max(Number(offsetRaw) || 0, 0);
  let where: Prisma.InquiryDbListingWhereInput;

  if (opts?.viewerExternalCompanyId) {
    if (tab === 'my_sales') {
      return { items: [], total: 0, limit, offset };
    }
    where = buildExternalPartnerListWhere(tenantId, tab, opts.viewerExternalCompanyId);
  } else {
    where = buildListWhere(tenantId, tab);
  }

  const [rows, total] = await Promise.all([
    prisma.inquiryDbListing.findMany({
      where,
      include: LISTING_INCLUDE,
      take: limit,
      skip: offset,
      orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.inquiryDbListing.count({ where }),
  ]);

  const filtered =
    tab === 'available'
      ? rows.filter((r) =>
          viewerCanSeeListing(tenantId, r, {
            externalCompanyId: opts?.viewerExternalCompanyId,
          }),
        )
      : rows;

  const items = filtered
    .map((row) =>
      buildMaskedListingDto({
        id: row.id,
        sellerTenantId: row.tenantId,
        sellerTenantName: row.tenant.name,
        status: row.status,
        visibility: row.visibility,
        listingFee: row.listingFee,
        displayAmount: row.displayAmount,
        publishedAt: row.publishedAt,
        expiresAt: row.expiresAt,
        platformSuspendedAt: row.platformSuspendedAt,
        inquiry: row.inquiry,
        role: resolveListRoleForViewer(tenantId, row, {
          externalCompanyId: opts?.viewerExternalCompanyId,
        }),
      }),
    )
    .sort((a, b) => {
      const rankDiff = listingStatusSortRank(a.status) - listingStatusSortRank(b.status);
      if (rankDiff !== 0) return rankDiff;
      const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return bTime - aTime;
    });

  return { items, total: tab === 'available' ? total : total, limit, offset };
}

export async function getDbMarketplaceListingById(
  viewerTenantId: string,
  listingId: string,
  opts?: { viewerExternalCompanyId?: string | null },
) {
  await expireStaleOpenDbListings();
  const row = await prisma.inquiryDbListing.findFirst({
    where: { id: listingId },
    include: {
      inquiry: { select: INQUIRY_FULL_SELECT },
      tenant: { select: { id: true, name: true } },
      buyerTenant: { select: { id: true, name: true } },
      buyerExternalCompany: { select: { id: true, name: true } },
      audiences: true,
    },
  });
  if (!row) throw new DbMarketplaceError('항목을 찾을 수 없습니다.', 404);

  const isSeller = row.tenantId === viewerTenantId;
  const isBuyer = row.buyerTenantId === viewerTenantId;
  const isExternalBuyer =
    !!opts?.viewerExternalCompanyId &&
    row.buyerKind === 'EXTERNAL_COMPANY' &&
    row.buyerExternalCompanyId === opts.viewerExternalCompanyId;
  const canSee = await viewerCanSeeListing(viewerTenantId, row, {
    externalCompanyId: opts?.viewerExternalCompanyId,
  });
  if (!canSee && !isSeller && !isBuyer && !isExternalBuyer) {
    throw new DbMarketplaceError('조회 권한이 없습니다.', 403);
  }

  const masked = buildMaskedListingDto({
    id: row.id,
    sellerTenantId: row.tenantId,
    sellerTenantName: row.tenant.name,
    status: row.status,
    visibility: row.visibility,
    listingFee: row.listingFee,
    displayAmount: row.displayAmount,
    publishedAt: row.publishedAt,
    expiresAt: row.expiresAt,
    platformSuspendedAt: row.platformSuspendedAt,
    inquiry: row.inquiry,
    role: isExternalBuyer ? 'BUYER' : resolveListRole(viewerTenantId, row),
  });

  const showFull = row.status === 'CONFIRMED' && (isSeller || isBuyer || isExternalBuyer);

  let targetInquiryId: string | null = null;
  if (row.status === 'CONFIRMED' && row.tenantInquiryShareId && isBuyer) {
    const share = await prisma.tenantInquiryShare.findFirst({
      where: { id: row.tenantInquiryShareId, targetTenantId: viewerTenantId },
      select: { targetInquiryId: true },
    });
    targetInquiryId = share?.targetInquiryId ?? null;
  }
  if (row.status === 'CONFIRMED' && row.buyerKind === 'EXTERNAL_COMPANY' && (isSeller || isExternalBuyer)) {
    targetInquiryId = row.inquiryId;
  }

  const detail: MarketplaceListingDetailDto = {
    ...masked,
    inquiryId: row.inquiryId,
    buyerKind: row.buyerKind,
    buyerName: row.buyerTenant?.name ?? row.buyerExternalCompany?.name ?? null,
    buyerConfirmedAt: row.buyerConfirmedAt?.toISOString() ?? null,
    sellerConfirmedAt: row.sellerConfirmedAt?.toISOString() ?? null,
    inquiryFull: showFull ? buildFullInquiryDto(row.inquiry) : null,
    targetInquiryId,
  };

  return detail;
}

export async function getDbListingForInquiry(tenantId: string, inquiryId: string) {
  const row = await prisma.inquiryDbListing.findFirst({
    where: { inquiryId, tenantId },
    include: {
      ...LISTING_INCLUDE,
      audiences: {
        include: {
          partnerTenant: { select: { id: true, name: true, slug: true } },
          externalCompany: { select: { id: true, name: true } },
        },
      },
    },
  });
  return row;
}

export function serializeSellerListing(row: {
  id: string;
  inquiryId: string;
  listingFee: number;
  displayAmount: number | null;
  status: string;
  visibility: string;
  publishedAt: Date | null;
  expiresAt?: Date | null;
  platformSuspendedAt?: Date | null;
  buyerKind?: string | null;
  buyerTenantId?: string | null;
  buyerExternalCompanyId?: string | null;
  buyerConfirmedAt?: Date | null;
  sellerConfirmedAt?: Date | null;
  buyerTenant?: { name: string } | null;
  buyerExternalCompany?: { name: string } | null;
  audiences?: Array<{
    id: string;
    audienceKind: string;
    partnerTenantId: string | null;
    externalCompanyId: string | null;
    partnerTenant?: { name: string } | null;
    externalCompany?: { name: string } | null;
  }>;
}) {
  return {
    id: row.id,
    inquiryId: row.inquiryId,
    listingFee: row.listingFee,
    displayAmount: row.displayAmount,
    status: row.status,
    visibility: row.visibility,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    platformSuspendedAt: row.platformSuspendedAt?.toISOString() ?? null,
    buyerKind: row.buyerKind ?? null,
    buyerTenantId: row.buyerTenantId ?? null,
    buyerExternalCompanyId: row.buyerExternalCompanyId ?? null,
    buyerName: row.buyerTenant?.name ?? row.buyerExternalCompany?.name ?? null,
    buyerConfirmedAt: row.buyerConfirmedAt?.toISOString() ?? null,
    sellerConfirmedAt: row.sellerConfirmedAt?.toISOString() ?? null,
    audiences: (row.audiences ?? []).map((a) => ({
      id: a.id,
      audienceKind: a.audienceKind,
      partnerTenantId: a.partnerTenantId,
      partnerTenantName: a.partnerTenant?.name ?? null,
      externalCompanyId: a.externalCompanyId,
      externalCompanyName: a.externalCompany?.name ?? null,
    })),
  };
}
