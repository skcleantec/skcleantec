import type { Prisma } from '@prisma/client';
import { createdAtRangeFromQuery } from '../inquiries/inquiryListDateRange.js';

export type DbMarketplaceListFilters = {
  buyerKind?: 'PARTNER_TENANT' | 'EXTERNAL_COMPANY';
  buyerId?: string;
  soldDatePreset?: 'today' | 'all' | 'month' | 'day';
  soldMonth?: string;
  soldDay?: string;
  handoverDatePreset?: 'today' | 'all' | 'month' | 'day';
  handoverMonth?: string;
  handoverDay?: string;
  groupByCompany?: boolean;
};

function parseDatePreset(raw: unknown): 'today' | 'all' | 'month' | 'day' | undefined {
  if (raw === 'today' || raw === 'all' || raw === 'month' || raw === 'day') return raw;
  return undefined;
}

function trimStr(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const s = raw.trim();
  return s || undefined;
}

export function parseDbMarketplaceListFilters(query: Record<string, unknown>): DbMarketplaceListFilters {
  const buyerKindRaw = trimStr(query.buyerKind);
  const buyerKind =
    buyerKindRaw === 'PARTNER_TENANT' || buyerKindRaw === 'EXTERNAL_COMPANY' ? buyerKindRaw : undefined;

  return {
    buyerKind,
    buyerId: trimStr(query.buyerId),
    soldDatePreset: parseDatePreset(query.soldDatePreset),
    soldMonth: trimStr(query.soldMonth),
    soldDay: trimStr(query.soldDay),
    handoverDatePreset: parseDatePreset(query.handoverDatePreset),
    handoverMonth: trimStr(query.handoverMonth),
    handoverDay: trimStr(query.handoverDay),
    groupByCompany: query.groupByCompany === '1' || query.groupByCompany === 'true',
  };
}

export type DbMarketplaceFilterTab = 'cart' | 'my_sales' | 'confirmed';

/** 장바구니·내 판매·확정 완료 목록 공통 필터 (장바구니는 판매일→담은 날·인계/구매자 필터 미적용) */
export function applyDbMarketplaceListFilters(
  base: Prisma.InquiryDbListingWhereInput,
  filters: DbMarketplaceListFilters,
  tab: DbMarketplaceFilterTab,
): Prisma.InquiryDbListingWhereInput {
  const parts: Prisma.InquiryDbListingWhereInput[] = [base];

  if (tab !== 'cart') {
    if (
      !filters.groupByCompany &&
      filters.buyerKind === 'PARTNER_TENANT' &&
      filters.buyerId
    ) {
      parts.push({ buyerTenantId: filters.buyerId });
    } else if (
      !filters.groupByCompany &&
      filters.buyerKind === 'EXTERNAL_COMPANY' &&
      filters.buyerId
    ) {
      parts.push({ buyerExternalCompanyId: filters.buyerId });
    }
  }

  const soldRange = createdAtRangeFromQuery({
    datePreset: filters.soldDatePreset,
    month: filters.soldMonth,
    day: filters.soldDay,
  });
  if (soldRange) {
    parts.push(tab === 'cart' ? { createdAt: soldRange } : { publishedAt: soldRange });
  }

  if (tab !== 'cart') {
    const handoverRange = createdAtRangeFromQuery({
      datePreset: filters.handoverDatePreset,
      month: filters.handoverMonth,
      day: filters.handoverDay,
    });
    if (handoverRange) {
      /** 인계일 미정(게시·인계대기)은 필터와 무관하게 목록에 유지 */
      parts.push({
        OR: [{ status: { in: ['OPEN', 'PENDING_SELLER'] } }, { sellerConfirmedAt: handoverRange }],
      });
    }
  }

  return parts.length === 1 ? base : { AND: parts };
}

/** @deprecated applyDbMarketplaceListFilters(tab: 'my_sales') 사용 */
export function applyMySalesListFilters(
  base: Prisma.InquiryDbListingWhereInput,
  filters: DbMarketplaceListFilters,
): Prisma.InquiryDbListingWhereInput {
  return applyDbMarketplaceListFilters(base, filters, 'my_sales');
}
