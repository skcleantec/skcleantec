import { randomUUID } from 'node:crypto';
import type {
  InquiryDbListingAudienceKind,
  InquiryDbListingBuyerKind,
  InquiryDbListingOfferMode,
  InquiryDbListingStatus,
  InquiryDbListingVisibility,
  Prisma,
} from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import {
  computeMarketplaceDisplayAmount,
  computeMarketplaceFeeAmounts,
  parseListingFeeInput,
  resolvePriorFeesTotalFromParent,
} from '../../lib/dbMarketplaceAmount.js';
import {
  expireStaleOpenDbListings,
} from './dbMarketplaceExpire.service.js';
import {
  buildMarketplaceHoldView,
  releaseExpiredDbListingHolds,
} from './dbMarketplaceHold.service.js';
import type { DbMarketplaceBuyerContext } from './dbMarketplaceBuyerAccess.js';
import { computeMarketplaceExpiresAt } from '../../lib/dbMarketplacePolicy.js';
import { selectableExternalCompanyWhere } from '../external-companies/externalCompanyUsage.helpers.js';
import { clearInternalInquiryAssignments } from '../assignments/clearInternalInquiryAssignments.js';
import { notifyInboxRefresh } from '../realtime/inboxNotify.js';
import {
  buildMaskedListingDto,
  buildFullInquiryDto,
  INQUIRY_FULL_SELECT,
  INQUIRY_MASK_SELECT,
  listingStatusSortRank,
  type MarketplaceListingDetailDto,
} from './dbMarketplaceListing.dto.js';
import {
  applyDbMarketplaceListFilters,
  type DbMarketplaceListFilters,
} from './dbMarketplaceListFilters.js';
import {
  findParentListingForResale,
  resolveRootListingId,
  resolveRootTenantId,
} from './dbMarketplaceChain.helpers.js';
import { appendDbMarketplaceEvent } from './dbMarketplaceHistory.service.js';
import {
  parseOfferMode,
  validatePriorityAudiences,
  viewerMatchesActivePriorityRank,
  type PriorityAudienceInput,
} from './dbMarketplacePriority.helpers.js';
import {
  isPriorityOfferMode,
  notifyDbMarketplacePriorityRank,
} from './dbMarketplacePriorityNotify.service.js';

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
  rootTenant: { select: { id: true, name: true } },
  audiences: true,
  buyerTenant: { select: { id: true, name: true } },
  buyerExternalCompany: { select: { id: true, name: true } },
} as const;

export type DbMarketplaceListTab = 'available' | 'cart' | 'my_sales' | 'pending' | 'confirmed';

function parseTab(raw: unknown): DbMarketplaceListTab {
  if (raw === 'cart' || raw === 'my_sales' || raw === 'pending' || raw === 'confirmed') return raw;
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
      tenantSharesAsSource: {
        where: { syncStatus: 'ACTIVE' },
        take: 1,
        select: { id: true },
      },
      dbListing: { select: { id: true, status: true } },
    },
  });
  if (!inquiry) throw new DbMarketplaceError('접수를 찾을 수 없습니다.', 404);

  const parentListing = await findParentListingForResale(tenantId, inquiryId);

  if (!parentListing && inquiry.tenantSharesAsSource.length > 0) {
    throw new DbMarketplaceError('이미 파트너에 직접 연계된 접수는 마켓에 올릴 수 없습니다.', 400);
  }

  return { inquiry, parentListing };
}

function assertPublishableBalance(
  customerBalanceAmount: number | null,
  listingFee: number,
) {
  if (customerBalanceAmount == null || !Number.isFinite(customerBalanceAmount)) {
    throw new DbMarketplaceError('고객 잔금을 확인한 뒤 수수료를 입력해 주세요.', 400);
  }
  if (Math.round(customerBalanceAmount) <= 0) {
    throw new DbMarketplaceError('고객 잔금을 확인한 뒤 수수료를 입력해 주세요.', 400);
  }
  if (!Number.isFinite(listingFee) || Math.round(listingFee) < 0) {
    throw new DbMarketplaceError('수수료를 입력해 주세요.', 400);
  }
}

type AudienceInput = PriorityAudienceInput;

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
    const priorityRankRaw = (row as { priorityRank?: unknown }).priorityRank;
    const priorityRank =
      typeof priorityRankRaw === 'number' && Number.isInteger(priorityRankRaw)
        ? priorityRankRaw
        : typeof priorityRankRaw === 'string' && /^[123]$/.test(priorityRankRaw.trim())
          ? Number(priorityRankRaw.trim())
          : null;
    if (kind === 'PARTNER_TENANT' && partnerTenantId) {
      out.push({ audienceKind: kind, partnerTenantId, externalCompanyId: null, priorityRank });
    } else if (kind === 'EXTERNAL_COMPANY' && externalCompanyId) {
      out.push({ audienceKind: kind, partnerTenantId: null, externalCompanyId, priorityRank });
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

  const { inquiry, parentListing } = await findInquiryForSeller(tenantId, inquiryId);
  const dealBalanceSnapshot =
    parentListing?.dealBalanceAmount ?? inquiry.serviceBalanceAmount;
  const priorFeesTotal = resolvePriorFeesTotalFromParent(parentListing);
  const feeAmounts = computeMarketplaceFeeAmounts({
    listingFee,
    priorFeesTotal,
    customerBalanceAmount: dealBalanceSnapshot,
  });
  assertPublishableBalance(feeAmounts.customerBalanceAmount, listingFee);

  const existing = inquiry.dbListing;
  if (
    existing &&
    existing.status !== 'DRAFT' &&
    existing.status !== 'WITHDRAWN' &&
    existing.status !== 'EXPIRED'
  ) {
    throw new DbMarketplaceError('이미 게시 중이거나 확정된 건은 장바구니를 수정할 수 없습니다.', 400);
  }

  const hopIndex = parentListing ? parentListing.hopIndex + 1 : 0;
  const rootTenantId = resolveRootTenantId(parentListing, tenantId);
  const parentListingId = parentListing?.id ?? null;
  const listingData = {
    listingFee: feeAmounts.listingFee,
    priorFeesTotal: feeAmounts.priorFeesTotal,
    buyerTotalFee: feeAmounts.buyerTotalFee,
    displayAmount: feeAmounts.displayAmount,
    status: 'DRAFT' as const,
    withdrawnAt: null,
    hopIndex,
    rootTenantId,
    parentListingId,
    dealBalanceAmount: dealBalanceSnapshot,
  };

  if (existing) {
    return prisma.inquiryDbListing.update({
      where: { id: existing.id, tenantId },
      data: {
        ...listingData,
        rootListingId: resolveRootListingId(parentListing, existing.id),
      },
      include: LISTING_INCLUDE,
    });
  }

  const id = randomUUID();
  const created = await prisma.inquiryDbListing.create({
    data: {
      id,
      tenantId,
      inquiryId,
      ...listingData,
      rootListingId: resolveRootListingId(parentListing, id),
    },
    include: LISTING_INCLUDE,
  });

  if (!parentListing) {
    await prisma.inquiryDbListing.update({
      where: { id: created.id },
      data: { rootListingId: created.id },
    });
  }

  await prisma.$transaction(async (tx) => {
    if (parentListing) {
      await appendDbMarketplaceEvent(tx, {
        tenantId,
        listingId: created.id,
        eventType: 'RESALE_DRAFT_CREATED',
        hopIndex,
        payload: { parentListingId: parentListing.id },
      });
    }
  });

  return prisma.inquiryDbListing.findUniqueOrThrow({
    where: { id: created.id },
    include: LISTING_INCLUDE,
  });
}

export async function updateDbListingAudience(
  tenantId: string,
  listingId: string,
  visibilityRaw: unknown,
  audiencesRaw: unknown,
  offerModeRaw?: unknown,
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
  const offerMode = parseOfferMode(visibility, offerModeRaw);

  if (visibility === 'SELECTED' && audiences.length === 0) {
    throw new DbMarketplaceError('노출할 업체를 1곳 이상 선택해 주세요.', 400);
  }

  if (offerMode === 'PRIORITY') {
    validatePriorityAudiences(audiences);
  } else if (visibility === 'SELECTED') {
    for (const a of audiences) {
      if (a.priorityRank != null) {
        throw new DbMarketplaceError('동시 노출 모드에서는 순위를 지정할 수 없습니다.', 400);
      }
    }
  }

  if (visibility === 'SELECTED') {
    for (const a of audiences) {
      if (a.audienceKind === 'EXTERNAL_COMPANY' && a.externalCompanyId) {
        const ext = await prisma.externalCompany.findFirst({
          where: { id: a.externalCompanyId, ...selectableExternalCompanyWhere(tenantId) },
        });
        if (!ext) {
          throw new DbMarketplaceError(
            '타업체를 찾을 수 없거나 사용 중지된 업체입니다.',
            400,
          );
        }
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
          priorityRank: offerMode === 'PRIORITY' ? a.priorityRank ?? null : null,
        })),
      });
    }
    const currentPriorityRank: number | null =
      visibility === 'ALL' || offerMode !== 'PRIORITY'
        ? null
        : listing.status === 'OPEN'
          ? 1
          : null;
    return tx.inquiryDbListing.update({
      where: { id: listingId, tenantId },
      data: {
        visibility,
        offerMode,
        currentPriorityRank,
      },
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

  assertPublishableBalance(
    listing.dealBalanceAmount ?? listing.inquiry.serviceBalanceAmount,
    listing.listingFee,
  );
  const displayAmount =
    listing.displayAmount ??
    computeMarketplaceDisplayAmount(
      listing.dealBalanceAmount ?? listing.inquiry.serviceBalanceAmount,
      listing.listingFee,
    );

  if (listing.visibility === 'SELECTED') {
    const count = await prisma.inquiryDbListingAudience.count({ where: { listingId } });
    if (count === 0) throw new DbMarketplaceError('노출 대상을 선택해 주세요.', 400);
    if (listing.offerMode === 'PRIORITY') {
      const ranked = await prisma.inquiryDbListingAudience.count({
        where: { listingId, priorityRank: 1 },
      });
      if (ranked === 0) throw new DbMarketplaceError('1순위 구매 후보를 선택해 주세요.', 400);
    }
  }

  const now = new Date();
  const published = await prisma.$transaction(async (tx) => {
    const row = await tx.inquiryDbListing.update({
      where: { id: listingId, tenantId },
      data: {
        status: 'OPEN',
        displayAmount,
        publishedAt: now,
        withdrawnAt: null,
        expiredAt: null,
        expiresAt: computeMarketplaceExpiresAt(now),
        platformSuspendedAt: null,
        holdBuyerKind: null,
        holdBuyerTenantId: null,
        holdBuyerExternalCompanyId: null,
        holdByUserId: null,
        heldUntil: null,
        currentPriorityRank: isPriorityOfferMode(listing.offerMode) ? 1 : null,
      },
      include: LISTING_INCLUDE,
    });

    if (isPriorityOfferMode(listing.offerMode)) {
      await appendDbMarketplaceEvent(tx, {
        tenantId,
        listingId,
        eventType: 'PRIORITY_ACTIVATED',
        hopIndex: row.hopIndex,
        payload: { rank: 1 },
      });
    }

    return row;
  });

  const removedLeaderIds = await clearInternalInquiryAssignments(
    prisma,
    tenantId,
    published.inquiryId,
  );
  if (removedLeaderIds.length > 0) {
    void notifyInboxRefresh(removedLeaderIds);
  }

  if (isPriorityOfferMode(published.offerMode)) {
    void notifyDbMarketplacePriorityRank({
      sellerTenantId: tenantId,
      audiences: published.audiences,
      rank: 1,
    });
  }

  return published;
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
      holdBuyerKind: null,
      holdBuyerTenantId: null,
      holdBuyerExternalCompanyId: null,
      holdByUserId: null,
      heldUntil: null,
    },
    include: LISTING_INCLUDE,
  });
}

/** 장바구니(DRAFT) — 정보공유 등록 자체를 취소(접수 원상복귀) */
export async function removeDbListingFromCart(tenantId: string, listingId: string) {
  const listing = await prisma.inquiryDbListing.findFirst({
    where: { id: listingId, tenantId },
    select: { id: true, inquiryId: true, status: true },
  });
  if (!listing) throw new DbMarketplaceError('판매 항목을 찾을 수 없습니다.', 404);
  if (listing.status !== 'DRAFT') {
    throw new DbMarketplaceError('장바구니 항목만 원상복귀할 수 있습니다.', 400);
  }

  await prisma.inquiryDbListing.delete({ where: { id: listingId, tenantId } });
  return { id: listing.id, inquiryId: listing.inquiryId };
}

/** 게시(OPEN) — 노출·대상 설정 유지한 채 장바구니(DRAFT)로 되돌림 */
export async function revertDbListingToCart(tenantId: string, listingId: string) {
  const listing = await prisma.inquiryDbListing.findFirst({
    where: { id: listingId, tenantId },
  });
  if (!listing) throw new DbMarketplaceError('판매 항목을 찾을 수 없습니다.', 404);
  if (listing.status !== 'OPEN') {
    throw new DbMarketplaceError('게시 중인 건만 장바구니로 되돌릴 수 있습니다.', 400);
  }

  return prisma.inquiryDbListing.update({
    where: { id: listingId, tenantId },
    data: {
      status: 'DRAFT',
      publishedAt: null,
      expiresAt: null,
      expiredAt: null,
      withdrawnAt: null,
      holdBuyerKind: null,
      holdBuyerTenantId: null,
      holdBuyerExternalCompanyId: null,
      holdByUserId: null,
      heldUntil: null,
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

/** 판매자 — 게시 중(OPEN) — 내 판매 탭 */
export async function countDbListingOpen(tenantId: string): Promise<number> {
  return prisma.inquiryDbListing.count({
    where: { tenantId, status: 'OPEN' },
  });
}

/** 파트너 구매자 — 판매자 인계 대기(타 업체 listing 구매 신청 후) */
export async function countDbListingPendingBuyer(tenantId: string): Promise<number> {
  return prisma.inquiryDbListing.count({
    where: { buyerTenantId: tenantId, status: 'PENDING_SELLER' },
  });
}

/** 타업체 — 구매 신청 후 판매자 인계 대기 */
export async function countDbListingPendingForExternalBuyer(
  tenantId: string,
  externalCompanyId: string,
): Promise<number> {
  return prisma.inquiryDbListing.count({
    where: {
      tenantId,
      status: 'PENDING_SELLER',
      buyerExternalCompanyId: externalCompanyId,
    },
  });
}

export async function viewerCanSeeListing(
  tenantId: string,
  listing: {
    tenantId: string;
    status: InquiryDbListingStatus;
    visibility: InquiryDbListingVisibility;
    offerMode?: InquiryDbListingOfferMode | null;
    currentPriorityRank?: number | null;
    platformSuspendedAt?: Date | null;
    buyerTenantId?: string | null;
    buyerExternalCompanyId?: string | null;
    audiences: Array<{
      audienceKind: InquiryDbListingAudienceKind;
      partnerTenantId: string | null;
      externalCompanyId: string | null;
      priorityRank?: number | null;
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
      if (!(await isSelectableExternalCompanyOnTenant(tenantId, opts.externalCompanyId))) {
        return false;
      }
      if (listing.visibility === 'ALL') {
        if (listing.status === 'OPEN' && listing.platformSuspendedAt) return false;
        return listing.status === 'OPEN' || listing.status === 'PENDING_SELLER' || listing.status === 'CONFIRMED';
      }
      if (listing.offerMode === 'PRIORITY') {
        if (listing.status === 'PENDING_SELLER' || listing.status === 'CONFIRMED') {
          return listing.buyerExternalCompanyId === opts.externalCompanyId;
        }
        if (listing.status !== 'OPEN' || listing.platformSuspendedAt) return false;
        return viewerMatchesActivePriorityRank(listing, {
          kind: 'EXTERNAL_COMPANY',
          externalCompanyId: opts.externalCompanyId,
        });
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

  if (opts?.externalCompanyId) {
    return false;
  }

  if (!(await hasActivePartnershipWith(listing.tenantId, tenantId))) {
    return false;
  }
  if (listing.visibility === 'ALL') return true;
  if (listing.offerMode === 'PRIORITY') {
    if (listing.status === 'PENDING_SELLER') {
      return listing.buyerTenantId === tenantId;
    }
    if (listing.status !== 'OPEN') return false;
    return viewerMatchesActivePriorityRank(listing, { kind: 'PARTNER_TENANT', tenantId });
  }
  return listing.audiences.some(
    (a) => a.audienceKind === 'PARTNER_TENANT' && a.partnerTenantId === tenantId,
  );
}

async function hasActivePartnershipWith(sellerTenantId: string, viewerTenantId: string): Promise<boolean> {
  const row = await prisma.tenantPartnership.findFirst({
    where: {
      status: 'ACTIVE',
      OR: [
        { tenantLowId: sellerTenantId, tenantHighId: viewerTenantId },
        { tenantLowId: viewerTenantId, tenantHighId: sellerTenantId },
      ],
    },
    select: { id: true },
  });
  return Boolean(row);
}

async function isActiveExternalCompanyOnTenant(
  tenantId: string,
  externalCompanyId: string,
): Promise<boolean> {
  const row = await prisma.externalCompany.findFirst({
    where: { id: externalCompanyId, tenantId, isActive: true },
    select: { id: true },
  });
  return Boolean(row);
}

async function isSelectableExternalCompanyOnTenant(
  tenantId: string,
  externalCompanyId: string,
): Promise<boolean> {
  const row = await prisma.externalCompany.findFirst({
    where: { id: externalCompanyId, ...selectableExternalCompanyWhere(tenantId) },
    select: { id: true },
  });
  return Boolean(row);
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
  /** 타업체는 호스트 테넌트 소속이지만 마켓 판매자가 아님 — 구매자(VIEWER/BUYER)만 */
  if (opts?.externalCompanyId && listing.tenantId === tenantId) {
    return 'VIEWER';
  }
  return resolveListRole(tenantId, listing);
}

/** 정보공유 노출 대상 선택 — ACTIVE 파트너·등록 타업체 (mod_db_marketplace 전용, tenant exchange API 불필요) */
export async function listDbMarketplaceAudienceOptions(tenantId: string) {
  const partnerships = await prisma.tenantPartnership.findMany({
    where: {
      status: 'ACTIVE',
      OR: [{ tenantLowId: tenantId }, { tenantHighId: tenantId }],
    },
    include: {
      tenantLow: { select: { id: true, name: true, slug: true } },
      tenantHigh: { select: { id: true, name: true, slug: true } },
    },
    orderBy: [{ updatedAt: 'desc' }],
  });

  const partnerById = new Map<string, { id: string; name: string; slug: string }>();
  for (const row of partnerships) {
    const partner = row.tenantLowId === tenantId ? row.tenantHigh : row.tenantLow;
    if (partner.id !== tenantId) {
      partnerById.set(partner.id, partner);
    }
  }

  const externalCompanies = await prisma.externalCompany.findMany({
    where: selectableExternalCompanyWhere(tenantId),
    select: { id: true, name: true },
    orderBy: { name: 'asc' },
  });

  return {
    partners: [...partnerById.values()].sort((a, b) => a.name.localeCompare(b.name, 'ko')),
    externalCompanies,
  };
}

function partnerTenantPartnershipWhere(viewerTenantId: string): Prisma.TenantWhereInput {
  return {
    OR: [
      {
        partnershipsAsLow: {
          some: { tenantHighId: viewerTenantId, status: 'ACTIVE' },
        },
      },
      {
        partnershipsAsHigh: {
          some: { tenantLowId: viewerTenantId, status: 'ACTIVE' },
        },
      },
    ],
  };
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
      audiences: { some: { externalCompanyId, audienceKind: 'EXTERNAL_COMPANY' } },
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
    case 'cart':
      return { tenantId, status: 'DRAFT' };
    case 'my_sales':
      return { tenantId, status: { not: 'DRAFT' } };
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
        tenant: partnerTenantPartnershipWhere(tenantId),
        OR: [
          { visibility: 'ALL' },
          {
            visibility: 'SELECTED',
            audiences: { some: { partnerTenantId: tenantId, audienceKind: 'PARTNER_TENANT' } },
          },
        ],
      };
  }
}

function resolveBuyerContextForViewer(
  tenantId: string,
  opts?: { viewerExternalCompanyId?: string | null },
): DbMarketplaceBuyerContext | null {
  if (opts?.viewerExternalCompanyId) {
    return {
      kind: 'EXTERNAL_COMPANY',
      tenantId,
      userId: '',
      externalCompanyId: opts.viewerExternalCompanyId,
    };
  }
  return { kind: 'PARTNER_TENANT', tenantId, userId: '' };
}

export async function listDbMarketplaceListings(
  tenantId: string,
  tabRaw: unknown,
  limitRaw: unknown,
  offsetRaw: unknown,
  opts?: { viewerExternalCompanyId?: string | null; filters?: DbMarketplaceListFilters },
) {
  await expireStaleOpenDbListings();
  await releaseExpiredDbListingHolds();
  const tab = parseTab(tabRaw);
  const limit = Math.min(Math.max(Number(limitRaw) || 30, 1), 100);
  const offset = Math.max(Number(offsetRaw) || 0, 0);
  let where: Prisma.InquiryDbListingWhereInput;

  if (opts?.viewerExternalCompanyId) {
    if (tab === 'my_sales' || tab === 'cart') {
      return { items: [], total: 0, limit, offset };
    }
    where = buildExternalPartnerListWhere(tenantId, tab, opts.viewerExternalCompanyId);
  } else {
    where = buildListWhere(tenantId, tab);
    if (
      (tab === 'my_sales' || tab === 'cart' || tab === 'confirmed') &&
      opts?.filters
    ) {
      where = applyDbMarketplaceListFilters(where, opts.filters, tab);
    }
  }

  const listOrderBy: Prisma.InquiryDbListingOrderByWithRelationInput[] =
    tab === 'cart'
      ? [{ updatedAt: 'desc' }]
      : [{ publishedAt: 'desc' }, { createdAt: 'desc' }];

  const [rows, total] = await Promise.all([
    prisma.inquiryDbListing.findMany({
      where,
      include: LISTING_INCLUDE,
      take: limit,
      skip: offset,
      orderBy: listOrderBy,
    }),
    prisma.inquiryDbListing.count({ where }),
  ]);

  const filtered =
    tab === 'available'
      ? (
          await Promise.all(
            rows.map(async (r) => ({
              row: r,
              ok: await viewerCanSeeListing(tenantId, r, {
                externalCompanyId: opts?.viewerExternalCompanyId,
              }),
            })),
          )
        )
          .filter((x) => x.ok)
          .map((x) => x.row)
      : rows;

  const buyerCtx = resolveBuyerContextForViewer(tenantId, opts);
  const items = filtered
    .map((row) => {
      const role = resolveListRoleForViewer(tenantId, row, {
        externalCompanyId: opts?.viewerExternalCompanyId,
      });
      const hold = buildMarketplaceHoldView({
        listing: row,
        viewerRole: role,
        buyer: role === 'VIEWER' ? buyerCtx : null,
      });
      const masked = buildMaskedListingDto({
        id: row.id,
        sellerTenantId: row.tenantId,
        sellerTenantName: row.tenant.name,
        status: row.status,
        visibility: row.visibility,
        listingFee: row.listingFee,
        displayAmount: row.displayAmount,
        priorFeesTotal: row.priorFeesTotal,
        buyerTotalFee: row.buyerTotalFee,
        publishedAt: row.publishedAt,
        expiresAt: row.expiresAt,
        platformSuspendedAt: row.platformSuspendedAt,
        inquiry: row.inquiry,
        role,
        hold,
        hopIndex: row.hopIndex,
        rootTenantId: row.rootTenantId,
        rootTenantName: row.rootTenant?.name ?? null,
        dealBalanceAmount: row.dealBalanceAmount,
      });
      if (role === 'SELLER') {
        return {
          ...masked,
          listingFee: row.listingFee,
          inquiryId: row.inquiryId,
          sellerConfirmedAt: row.sellerConfirmedAt?.toISOString() ?? null,
          buyerName: row.buyerTenant?.name ?? row.buyerExternalCompany?.name ?? null,
          offerMode: row.offerMode ?? null,
          currentPriorityRank: row.currentPriorityRank ?? null,
        };
      }
      return masked;
    })
    .sort((a, b) => {
      if (
        opts?.filters?.groupByCompany &&
        (tab === 'my_sales' || tab === 'confirmed')
      ) {
        const buyerLabel = (row: typeof a) =>
          'buyerName' in row && row.buyerName?.trim() ? row.buyerName.trim() : '';
        const nullRank = (name: string) => (name ? 0 : 1);
        const buyerCmp =
          nullRank(buyerLabel(a)) - nullRank(buyerLabel(b)) ||
          buyerLabel(a).localeCompare(buyerLabel(b), 'ko');
        if (buyerCmp !== 0) return buyerCmp;
      }
      const rankDiff = listingStatusSortRank(a.status) - listingStatusSortRank(b.status);
      if (rankDiff !== 0) return rankDiff;
      const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
      const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
      return bTime - aTime;
    });

  return { items, total, limit, offset };
}

export async function getDbMarketplaceListingById(
  viewerTenantId: string,
  listingId: string,
  opts?: { viewerExternalCompanyId?: string | null },
) {
  await expireStaleOpenDbListings();
  await releaseExpiredDbListingHolds();
  const row = await prisma.inquiryDbListing.findFirst({
    where: { id: listingId },
    include: {
      inquiry: { select: INQUIRY_FULL_SELECT },
      tenant: { select: { id: true, name: true } },
      rootTenant: { select: { id: true, name: true } },
      buyerTenant: { select: { id: true, name: true } },
      buyerExternalCompany: { select: { id: true, name: true } },
      holdBuyerTenant: { select: { id: true, name: true } },
      holdBuyerExternalCompany: { select: { id: true, name: true } },
      audiences: {
        include: {
          partnerTenant: { select: { id: true, name: true } },
          externalCompany: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!row) throw new DbMarketplaceError('항목을 찾을 수 없습니다.', 404);

  const isActualSeller = row.tenantId === viewerTenantId && !opts?.viewerExternalCompanyId;
  const isBuyer = row.buyerTenantId === viewerTenantId;
  const isExternalBuyer =
    !!opts?.viewerExternalCompanyId &&
    row.buyerKind === 'EXTERNAL_COMPANY' &&
    row.buyerExternalCompanyId === opts.viewerExternalCompanyId;
  const canSee = await viewerCanSeeListing(viewerTenantId, row, {
    externalCompanyId: opts?.viewerExternalCompanyId,
  });
  if (!canSee && !isActualSeller && !isBuyer && !isExternalBuyer) {
    throw new DbMarketplaceError('조회 권한이 없습니다.', 403);
  }

  const role = isExternalBuyer
    ? 'BUYER'
    : resolveListRoleForViewer(viewerTenantId, row, {
        externalCompanyId: opts?.viewerExternalCompanyId,
      });
  const buyerCtx =
    role === 'VIEWER' || role === 'BUYER'
      ? opts?.viewerExternalCompanyId
        ? ({
            kind: 'EXTERNAL_COMPANY',
            tenantId: viewerTenantId,
            userId: '',
            externalCompanyId: opts.viewerExternalCompanyId,
          } satisfies DbMarketplaceBuyerContext)
        : ({ kind: 'PARTNER_TENANT', tenantId: viewerTenantId, userId: '' } satisfies DbMarketplaceBuyerContext)
      : null;

  const hold = buildMarketplaceHoldView({
    listing: row,
    viewerRole: role,
    buyer: buyerCtx,
  });

  const masked = buildMaskedListingDto({
    id: row.id,
    sellerTenantId: row.tenantId,
    sellerTenantName: row.tenant.name,
    status: row.status,
    visibility: row.visibility,
    listingFee: row.listingFee,
    displayAmount: row.displayAmount,
    priorFeesTotal: row.priorFeesTotal,
    buyerTotalFee: row.buyerTotalFee,
    publishedAt: row.publishedAt,
    expiresAt: row.expiresAt,
    platformSuspendedAt: row.platformSuspendedAt,
    inquiry: row.inquiry,
    role,
    hold,
    hopIndex: row.hopIndex,
    rootTenantId: row.rootTenantId,
    rootTenantName: row.rootTenant?.name ?? null,
    dealBalanceAmount: row.dealBalanceAmount,
  });

  const showFull = row.status === 'CONFIRMED' && (isActualSeller || isBuyer || isExternalBuyer);

  let targetInquiryId: string | null = null;
  if (row.status === 'CONFIRMED' && row.tenantInquiryShareId && isBuyer) {
    const share = await prisma.tenantInquiryShare.findFirst({
      where: { id: row.tenantInquiryShareId, targetTenantId: viewerTenantId },
      select: { targetInquiryId: true },
    });
    targetInquiryId = share?.targetInquiryId ?? null;
  }
  if (row.status === 'CONFIRMED' && row.buyerKind === 'EXTERNAL_COMPANY' && (isActualSeller || isExternalBuyer)) {
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
    ...(isActualSeller
      ? {
          audiences: (row.audiences ?? []).map((a) => ({
            id: a.id,
            audienceKind: a.audienceKind,
            partnerTenantId: a.partnerTenantId,
            partnerTenantName: a.partnerTenant?.name ?? null,
            externalCompanyId: a.externalCompanyId,
            externalCompanyName: a.externalCompany?.name ?? null,
          })),
        }
      : {}),
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
  priorFeesTotal?: number;
  buyerTotalFee?: number;
  displayAmount: number | null;
  dealBalanceAmount?: number | null;
  status: string;
  visibility: string;
  offerMode?: string | null;
  currentPriorityRank?: number | null;
  publishedAt: Date | null;
  expiresAt?: Date | null;
  platformSuspendedAt?: Date | null;
  buyerKind?: string | null;
  buyerTenantId?: string | null;
  buyerExternalCompanyId?: string | null;
  buyerConfirmedAt?: Date | null;
  sellerConfirmedAt?: Date | null;
  hopIndex?: number;
  rootTenantId?: string | null;
  rootTenant?: { name: string } | null;
  buyerTenant?: { name: string } | null;
  buyerExternalCompany?: { name: string } | null;
  audiences?: Array<{
    id: string;
    audienceKind: string;
    partnerTenantId: string | null;
    externalCompanyId: string | null;
    priorityRank?: number | null;
    partnerTenant?: { name: string } | null;
    externalCompany?: { name: string } | null;
  }>;
}) {
  return {
    id: row.id,
    inquiryId: row.inquiryId,
    listingFee: row.listingFee,
    priorFeesTotal: row.priorFeesTotal ?? 0,
    buyerTotalFee: row.buyerTotalFee ?? row.listingFee,
    customerBalanceAmount: row.dealBalanceAmount ?? row.displayAmount,
    displayAmount: row.dealBalanceAmount ?? row.displayAmount,
    status: row.status,
    visibility: row.visibility,
    offerMode: row.offerMode ?? null,
    currentPriorityRank: row.currentPriorityRank ?? null,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    platformSuspendedAt: row.platformSuspendedAt?.toISOString() ?? null,
    buyerKind: row.buyerKind ?? null,
    buyerTenantId: row.buyerTenantId ?? null,
    buyerExternalCompanyId: row.buyerExternalCompanyId ?? null,
    buyerName: row.buyerTenant?.name ?? row.buyerExternalCompany?.name ?? null,
    buyerConfirmedAt: row.buyerConfirmedAt?.toISOString() ?? null,
    sellerConfirmedAt: row.sellerConfirmedAt?.toISOString() ?? null,
    resaleStep: row.hopIndex ?? 0,
    hopIndex: row.hopIndex ?? 0,
    rootTenantId: row.rootTenantId ?? null,
    rootTenantName: row.rootTenant?.name ?? null,
    dealBalanceAmount: row.dealBalanceAmount ?? null,
    audiences: (row.audiences ?? []).map((a) => ({
      id: a.id,
      audienceKind: a.audienceKind,
      partnerTenantId: a.partnerTenantId,
      partnerTenantName: a.partnerTenant?.name ?? null,
      externalCompanyId: a.externalCompanyId,
      externalCompanyName: a.externalCompany?.name ?? null,
      priorityRank: a.priorityRank ?? null,
    })),
  };
}
