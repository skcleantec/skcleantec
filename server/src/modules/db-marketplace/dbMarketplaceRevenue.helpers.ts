import type { TenantPartnerSettlementRole } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import {
  computeMarketplaceBuyerCompanyRevenue,
  computeMarketplaceSellerRevenue,
  MARKETPLACE_REVENUE_LABEL_BUYER,
} from '../../lib/dbMarketplaceAmount.js';

export type MarketplaceShareRevenueMeta = {
  hopIndex: number;
  listingFee: number;
  buyerTotalFee: number;
  sourceServiceDepositAmount: number | null;
  sourceServiceTotalAmount: number | null;
  sourceServiceBalanceAmount: number | null;
  targetServiceDepositAmount: number | null;
  targetServiceTotalAmount: number | null;
  targetServiceBalanceAmount: number | null;
};

export type MarketplaceInquiryRevenueLine = {
  amount: number;
  label: string;
};

/** CONFIRMED listing ↔ share — hop·금액·양쪽 접수 스냅 */
export async function loadMarketplaceShareRevenueMetaMap(
  shareIds: string[],
): Promise<Map<string, MarketplaceShareRevenueMeta>> {
  const ids = [...new Set(shareIds.filter(Boolean))];
  if (ids.length === 0) return new Map();

  const rows = await prisma.inquiryDbListing.findMany({
    where: {
      tenantInquiryShareId: { in: ids },
      status: 'CONFIRMED',
    },
    select: {
      tenantInquiryShareId: true,
      hopIndex: true,
      listingFee: true,
      buyerTotalFee: true,
      inquiry: {
        select: {
          serviceDepositAmount: true,
          serviceTotalAmount: true,
          serviceBalanceAmount: true,
        },
      },
    },
  });

  const shareRows = await prisma.tenantInquiryShare.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      targetInquiry: {
        select: {
          serviceDepositAmount: true,
          serviceTotalAmount: true,
          serviceBalanceAmount: true,
        },
      },
    },
  });
  const targetByShareId = new Map(shareRows.map((s) => [s.id, s.targetInquiry]));

  const map = new Map<string, MarketplaceShareRevenueMeta>();
  for (const row of rows) {
    if (!row.tenantInquiryShareId) continue;
    const target = targetByShareId.get(row.tenantInquiryShareId);
    map.set(row.tenantInquiryShareId, {
      hopIndex: row.hopIndex,
      listingFee: row.listingFee,
      buyerTotalFee: row.buyerTotalFee > 0 ? row.buyerTotalFee : row.listingFee,
      sourceServiceDepositAmount: row.inquiry.serviceDepositAmount,
      sourceServiceTotalAmount: row.inquiry.serviceTotalAmount,
      sourceServiceBalanceAmount: row.inquiry.serviceBalanceAmount,
      targetServiceDepositAmount: target?.serviceDepositAmount ?? null,
      targetServiceTotalAmount: target?.serviceTotalAmount ?? null,
      targetServiceBalanceAmount: target?.serviceBalanceAmount ?? null,
    });
  }
  return map;
}

export function computeMarketplaceShareRevenueForRole(
  role: TenantPartnerSettlementRole,
  meta: MarketplaceShareRevenueMeta,
): MarketplaceInquiryRevenueLine {
  if (role === 'SELLER') {
    const seller = computeMarketplaceSellerRevenue({
      hopIndex: meta.hopIndex,
      serviceDepositAmount: meta.sourceServiceDepositAmount,
      listingFee: meta.listingFee,
    });
    return { amount: seller.amount, label: seller.label };
  }
  const amount = computeMarketplaceBuyerCompanyRevenue({
    serviceTotalAmount: meta.targetServiceTotalAmount,
    serviceDepositAmount: meta.targetServiceDepositAmount,
    serviceBalanceAmount: meta.targetServiceBalanceAmount,
    buyerTotalFee: meta.buyerTotalFee,
  });
  return { amount, label: MARKETPLACE_REVENUE_LABEL_BUYER };
}

export type MarketplaceSourceListingRevenueMeta = {
  hopIndex: number;
  listingFee: number;
  serviceDepositAmount: number | null;
};

/** 판매 접수(inquiryId) 기준 — 타업체 정산 등 */
export async function loadMarketplaceSourceListingRevenueMetaMap(
  inquiryIds: string[],
): Promise<Map<string, MarketplaceSourceListingRevenueMeta>> {
  const ids = [...new Set(inquiryIds.filter(Boolean))];
  if (ids.length === 0) return new Map();

  const rows = await prisma.inquiryDbListing.findMany({
    where: {
      inquiryId: { in: ids },
      status: 'CONFIRMED',
    },
    select: {
      inquiryId: true,
      hopIndex: true,
      listingFee: true,
      inquiry: { select: { serviceDepositAmount: true } },
    },
  });

  const map = new Map<string, MarketplaceSourceListingRevenueMeta>();
  for (const row of rows) {
    map.set(row.inquiryId, {
      hopIndex: row.hopIndex,
      listingFee: row.listingFee,
      serviceDepositAmount: row.inquiry.serviceDepositAmount,
    });
  }
  return map;
}

export function computeMarketplaceSourceInquiryRevenue(
  meta: MarketplaceSourceListingRevenueMeta,
): MarketplaceInquiryRevenueLine {
  const seller = computeMarketplaceSellerRevenue({
    hopIndex: meta.hopIndex,
    serviceDepositAmount: meta.serviceDepositAmount,
    listingFee: meta.listingFee,
  });
  return { amount: seller.amount, label: seller.label };
}

export type MarketplaceBuyerInquiryRevenueMeta = {
  buyerTotalFee: number;
  serviceTotalAmount: number | null;
  serviceDepositAmount: number | null;
  serviceBalanceAmount: number | null;
};

/** 급여·대시보드 — 구매 mirror(target) 또는 타업체 배정(판매 접수) */
export async function loadMarketplaceBuyerRevenueMetaByInquiryId(
  tenantId: string,
  inquiryIds: string[],
): Promise<Map<string, MarketplaceBuyerInquiryRevenueMeta>> {
  const ids = [...new Set(inquiryIds.filter(Boolean))];
  if (ids.length === 0) return new Map();

  const map = new Map<string, MarketplaceBuyerInquiryRevenueMeta>();

  const targetShares = await prisma.tenantInquiryShare.findMany({
    where: { targetInquiryId: { in: ids }, targetInquiry: { tenantId } },
    select: {
      id: true,
      targetInquiryId: true,
      transferFee: true,
      targetInquiry: {
        select: {
          serviceTotalAmount: true,
          serviceDepositAmount: true,
          serviceBalanceAmount: true,
        },
      },
    },
  });

  const shareIds = targetShares.map((s) => s.id);
  const listingsByShareId = new Map<string, { buyerTotalFee: number; listingFee: number }>();
  if (shareIds.length > 0) {
    const listingRows = await prisma.inquiryDbListing.findMany({
      where: { tenantInquiryShareId: { in: shareIds }, status: 'CONFIRMED' },
      select: { tenantInquiryShareId: true, buyerTotalFee: true, listingFee: true },
    });
    for (const row of listingRows) {
      if (row.tenantInquiryShareId) {
        listingsByShareId.set(row.tenantInquiryShareId, {
          buyerTotalFee: row.buyerTotalFee,
          listingFee: row.listingFee,
        });
      }
    }
  }

  for (const share of targetShares) {
    const listing = listingsByShareId.get(share.id);
    if (!listing) continue;
    const buyerTotalFee =
      listing.buyerTotalFee > 0
        ? listing.buyerTotalFee
        : share.transferFee ?? listing.listingFee;
    map.set(share.targetInquiryId, {
      buyerTotalFee,
      serviceTotalAmount: share.targetInquiry.serviceTotalAmount,
      serviceDepositAmount: share.targetInquiry.serviceDepositAmount,
      serviceBalanceAmount: share.targetInquiry.serviceBalanceAmount,
    });
  }

  const remaining = ids.filter((id) => !map.has(id));
  if (remaining.length === 0) return map;

  const externalListings = await prisma.inquiryDbListing.findMany({
    where: {
      tenantId,
      inquiryId: { in: remaining },
      status: 'CONFIRMED',
      buyerKind: 'EXTERNAL_COMPANY',
    },
    select: {
      inquiryId: true,
      buyerTotalFee: true,
      listingFee: true,
      inquiry: {
        select: {
          externalTransferFee: true,
          serviceTotalAmount: true,
          serviceDepositAmount: true,
          serviceBalanceAmount: true,
        },
      },
    },
  });

  for (const row of externalListings) {
    const inq = row.inquiry;
    const buyerTotalFee =
      row.buyerTotalFee > 0
        ? row.buyerTotalFee
        : inq.externalTransferFee ?? row.listingFee;
    map.set(row.inquiryId, {
      buyerTotalFee,
      serviceTotalAmount: inq.serviceTotalAmount,
      serviceDepositAmount: inq.serviceDepositAmount,
      serviceBalanceAmount: inq.serviceBalanceAmount,
    });
  }

  return map;
}

export function computeMarketplaceBuyerInquiryRevenue(
  meta: MarketplaceBuyerInquiryRevenueMeta,
): MarketplaceInquiryRevenueLine {
  const amount = computeMarketplaceBuyerCompanyRevenue({
    serviceTotalAmount: meta.serviceTotalAmount,
    serviceDepositAmount: meta.serviceDepositAmount,
    serviceBalanceAmount: meta.serviceBalanceAmount,
    buyerTotalFee: meta.buyerTotalFee,
  });
  return { amount, label: MARKETPLACE_REVENUE_LABEL_BUYER };
}

/** 대시보드 — 접수별 회사 매출 override (구매 우선, 없으면 판매) */
export async function loadMarketplaceInquiryRevenueOverrideMap(
  tenantId: string,
  inquiryIds: string[],
): Promise<Map<string, MarketplaceInquiryRevenueLine>> {
  const ids = [...new Set(inquiryIds.filter(Boolean))];
  if (ids.length === 0) return new Map();

  const out = new Map<string, MarketplaceInquiryRevenueLine>();

  const buyerMeta = await loadMarketplaceBuyerRevenueMetaByInquiryId(tenantId, ids);
  for (const [inquiryId, meta] of buyerMeta) {
    out.set(inquiryId, computeMarketplaceBuyerInquiryRevenue(meta));
  }

  const sellerCandidates = ids.filter((id) => !out.has(id));
  if (sellerCandidates.length === 0) return out;

  const sellerMeta = await loadMarketplaceSourceListingRevenueMetaMap(sellerCandidates);
  for (const [inquiryId, meta] of sellerMeta) {
    out.set(inquiryId, computeMarketplaceSourceInquiryRevenue(meta));
  }

  return out;
}

export function resolvePayrollGeneralServiceAmount(
  serviceTotalAmount: number | null | undefined,
  buyerMeta: MarketplaceBuyerInquiryRevenueMeta | undefined,
): number {
  if (buyerMeta) {
    return computeMarketplaceBuyerCompanyRevenue({
      serviceTotalAmount: buyerMeta.serviceTotalAmount,
      serviceDepositAmount: buyerMeta.serviceDepositAmount,
      serviceBalanceAmount: buyerMeta.serviceBalanceAmount,
      buyerTotalFee: buyerMeta.buyerTotalFee,
    });
  }
  return Math.max(0, serviceTotalAmount ?? 0);
}
