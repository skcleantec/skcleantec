import { prisma } from '../../lib/prisma.js';

/** 파트너 share 정산 기준일 — 정보공유 인계 확정 건은 sellerConfirmedAt, 그 외 예약일 */
export function resolvePartnerShareSettlementEffectiveDate(
  preferredDate: Date | null,
  marketplaceSellerConfirmedAt: Date | null | undefined,
): Date | null {
  if (marketplaceSellerConfirmedAt) return marketplaceSellerConfirmedAt;
  return preferredDate ?? null;
}

/** CONFIRMED listing ↔ share — 인계 확정 시각 */
export async function loadMarketplaceShareConfirmAtMap(shareIds: string[]): Promise<Map<string, Date>> {
  const ids = [...new Set(shareIds.filter(Boolean))];
  if (ids.length === 0) return new Map();
  const rows = await prisma.inquiryDbListing.findMany({
    where: {
      tenantInquiryShareId: { in: ids },
      status: 'CONFIRMED',
      sellerConfirmedAt: { not: null },
    },
    select: { tenantInquiryShareId: true, sellerConfirmedAt: true },
  });
  const map = new Map<string, Date>();
  for (const row of rows) {
    if (row.tenantInquiryShareId && row.sellerConfirmedAt) {
      map.set(row.tenantInquiryShareId, row.sellerConfirmedAt);
    }
  }
  return map;
}

/** CONFIRMED listing과 연결된 TenantInquiryShare id 집합 */
export async function loadMarketplaceConfirmedShareIdSet(shareIds: string[]): Promise<Set<string>> {
  const ids = [...new Set(shareIds.filter(Boolean))];
  if (ids.length === 0) return new Set();
  const rows = await prisma.inquiryDbListing.findMany({
    where: {
      tenantInquiryShareId: { in: ids },
      status: 'CONFIRMED',
    },
    select: { tenantInquiryShareId: true },
  });
  const set = new Set<string>();
  for (const row of rows) {
    if (row.tenantInquiryShareId) set.add(row.tenantInquiryShareId);
  }
  return set;
}

/** CONFIRMED listing의 판매 접수(inquiryId) 집합 — 타업체 정산 등 */
export async function loadMarketplaceConfirmedInquiryIdSet(inquiryIds: string[]): Promise<Set<string>> {
  const ids = [...new Set(inquiryIds.filter(Boolean))];
  if (ids.length === 0) return new Set();
  const rows = await prisma.inquiryDbListing.findMany({
    where: {
      inquiryId: { in: ids },
      status: 'CONFIRMED',
    },
    select: { inquiryId: true },
  });
  return new Set(rows.map((r) => r.inquiryId));
}
