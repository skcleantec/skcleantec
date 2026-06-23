import { prisma } from '../../lib/prisma.js';

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
