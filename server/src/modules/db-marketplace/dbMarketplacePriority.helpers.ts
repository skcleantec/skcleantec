import type { InquiryDbListingAudienceKind, InquiryDbListingOfferMode } from '@prisma/client';
import { DbMarketplaceError } from './dbMarketplace.service.js';

export type PriorityAudienceInput = {
  audienceKind: InquiryDbListingAudienceKind;
  partnerTenantId?: string | null;
  externalCompanyId?: string | null;
  priorityRank?: number | null;
};

export type PriorityAudienceRow = {
  audienceKind: string;
  partnerTenantId: string | null;
  externalCompanyId: string | null;
  priorityRank?: number | null;
};

export function parseOfferMode(
  visibility: 'ALL' | 'SELECTED',
  raw: unknown,
): InquiryDbListingOfferMode | null {
  if (visibility !== 'SELECTED') return null;
  return raw === 'PRIORITY' ? 'PRIORITY' : 'SIMULTANEOUS';
}

export function validatePriorityAudiences(audiences: PriorityAudienceInput[]): void {
  const ranked = audiences.filter((a) => a.priorityRank != null);
  if (ranked.length === 0) {
    throw new DbMarketplaceError('1순위 구매 후보를 선택해 주세요.', 400);
  }

  const ranks = ranked.map((a) => a.priorityRank!);
  const unique = new Set(ranks);
  if (unique.size !== ranks.length) {
    throw new DbMarketplaceError('같은 순위에 업체를 두 번 넣을 수 없습니다.', 400);
  }
  if (!ranks.includes(1)) {
    throw new DbMarketplaceError('1순위 구매 후보는 필수입니다.', 400);
  }
  if (ranks.some((r) => r < 1 || r > 3)) {
    throw new DbMarketplaceError('순위는 1·2·3순위까지만 지정할 수 있습니다.', 400);
  }

  const sorted = [...ranks].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i] !== i + 1) {
      throw new DbMarketplaceError('순위는 1순위부터 빈 칸 없이 지정해 주세요. (예: 1만, 또는 1·2, 또는 1·2·3)', 400);
    }
  }

  const keys = new Set<string>();
  for (const a of ranked) {
    const key =
      a.audienceKind === 'PARTNER_TENANT'
        ? `p:${a.partnerTenantId}`
        : `e:${a.externalCompanyId}`;
    if (keys.has(key)) {
      throw new DbMarketplaceError('같은 업체를 여러 순위에 넣을 수 없습니다.', 400);
    }
    keys.add(key);
  }
}

export function audienceAtRank(
  audiences: PriorityAudienceRow[],
  rank: number,
): PriorityAudienceRow | undefined {
  return audiences.find((a) => a.priorityRank === rank);
}

export function buyerMatchesAudience(
  buyer: {
    kind: 'PARTNER_TENANT' | 'EXTERNAL_COMPANY';
    tenantId: string;
    externalCompanyId?: string;
  },
  audience: PriorityAudienceRow,
): boolean {
  if (buyer.kind === 'PARTNER_TENANT') {
    return (
      audience.audienceKind === 'PARTNER_TENANT' && audience.partnerTenantId === buyer.tenantId
    );
  }
  return (
    audience.audienceKind === 'EXTERNAL_COMPANY' &&
    audience.externalCompanyId === buyer.externalCompanyId
  );
}

export function resolveBuyerPriorityRank(
  listing: {
    buyerKind: string | null;
    buyerTenantId: string | null;
    buyerExternalCompanyId: string | null;
    audiences: PriorityAudienceRow[];
  },
): number | null {
  for (const a of listing.audiences) {
    if (a.priorityRank == null) continue;
    if (
      listing.buyerKind === 'PARTNER_TENANT' &&
      a.audienceKind === 'PARTNER_TENANT' &&
      a.partnerTenantId === listing.buyerTenantId
    ) {
      return a.priorityRank;
    }
    if (
      listing.buyerKind === 'EXTERNAL_COMPANY' &&
      a.audienceKind === 'EXTERNAL_COMPANY' &&
      a.externalCompanyId === listing.buyerExternalCompanyId
    ) {
      return a.priorityRank;
    }
  }
  return null;
}

export function viewerMatchesActivePriorityRank(
  listing: {
    offerMode?: InquiryDbListingOfferMode | null;
    currentPriorityRank?: number | null;
    audiences: PriorityAudienceRow[];
  },
  viewer: { kind: 'PARTNER_TENANT'; tenantId: string } | { kind: 'EXTERNAL_COMPANY'; externalCompanyId: string },
): boolean {
  if (listing.offerMode !== 'PRIORITY') return true;
  const rank = listing.currentPriorityRank;
  if (rank == null) return false;
  const row = audienceAtRank(listing.audiences, rank);
  if (!row) return false;
  if (viewer.kind === 'PARTNER_TENANT') {
    return row.audienceKind === 'PARTNER_TENANT' && row.partnerTenantId === viewer.tenantId;
  }
  return row.audienceKind === 'EXTERNAL_COMPANY' && row.externalCompanyId === viewer.externalCompanyId;
}

export function audienceRefFromRow(a: PriorityAudienceRow): {
  audienceKind: string;
  partnerTenantId: string | null;
  externalCompanyId: string | null;
} {
  return {
    audienceKind: a.audienceKind,
    partnerTenantId: a.partnerTenantId,
    externalCompanyId: a.externalCompanyId,
  };
}
