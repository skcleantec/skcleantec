/** 목록 페이지 크기 — 접수 목록 등 공통 */
export const INQUIRY_LIST_PAGE_SIZE_OPTIONS = [30, 50, 80, 100] as const;
export type InquiryListPageSize = (typeof INQUIRY_LIST_PAGE_SIZE_OPTIONS)[number];

export const INQUIRY_LIST_DEFAULT_PAGE_SIZE: InquiryListPageSize = 30;

/** 광고비 작업 종료 이력 — 기본 5건, 페이지당 선택 */
export const AD_SESSION_HISTORY_PAGE_SIZE_OPTIONS = [5, 10, 30, 50] as const;
export type AdSessionHistoryPageSize = (typeof AD_SESSION_HISTORY_PAGE_SIZE_OPTIONS)[number];
export const AD_SESSION_HISTORY_DEFAULT_PAGE_SIZE: AdSessionHistoryPageSize = 5;

export function parseAdSessionHistoryPageSize(raw: string | null | undefined): AdSessionHistoryPageSize {
  const n = raw ? parseInt(raw, 10) : NaN;
  if (AD_SESSION_HISTORY_PAGE_SIZE_OPTIONS.includes(n as AdSessionHistoryPageSize)) {
    return n as AdSessionHistoryPageSize;
  }
  return AD_SESSION_HISTORY_DEFAULT_PAGE_SIZE;
}

export function parseInquiryListPageSize(raw: string | null | undefined): InquiryListPageSize {
  const n = raw ? parseInt(raw, 10) : NaN;
  if (INQUIRY_LIST_PAGE_SIZE_OPTIONS.includes(n as InquiryListPageSize)) {
    return n as InquiryListPageSize;
  }
  return INQUIRY_LIST_DEFAULT_PAGE_SIZE;
}

export function parseListPage(raw: string | null | undefined): number {
  const n = raw ? parseInt(raw, 10) : NaN;
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

export function totalPages(total: number, pageSize: number): number {
  if (total <= 0) return 1;
  return Math.ceil(total / pageSize);
}

export function clampListPage(page: number, total: number, pageSize: number): number {
  return Math.min(Math.max(1, page), totalPages(total, pageSize));
}

export type PageToken = number | 'ellipsis';

/** 하단 페이지 번호(1 … 5 6 7 … 20)용 */
export function buildPageTokens(current: number, totalP: number): PageToken[] {
  if (totalP <= 0) return [];
  if (totalP <= 7) {
    return Array.from({ length: totalP }, (_, i) => i + 1);
  }
  const pages = new Set<number>([1, totalP, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalP).sort((a, b) => a - b);
  const out: PageToken[] = [];
  let prev = 0;
  for (const p of sorted) {
    if (prev && p - prev > 1) out.push('ellipsis');
    out.push(p);
    prev = p;
  }
  return out;
}
