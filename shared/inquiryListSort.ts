/**
 * 서비스접수 목록 정렬 — 서버·클라이언트 동일 규칙 (`.cursor/rules/inquiry-list-sort.mdc`)
 *
 * 처리 전 4종(미제출·입금완료·입금대기·대기)은 서버 `pinPreReceiveWhere` 로
 * **날짜·상태 필터와 무관하게** 목록 최상단에 tier 순으로 고정된다.
 * tier 0~3(pin)·tier 4(본문) 각각에서 사용자가 고른 열·방향으로 정렬한다.
 */

export type InquiryListSortField = 'createdAt' | 'preferredDate' | 'status';

export type InquiryListSortDir = 'asc' | 'desc';

export type InquiryListSortOptions = {
  field: InquiryListSortField;
  dir: InquiryListSortDir;
};

export const INQUIRY_LIST_SORT_FIELDS: readonly InquiryListSortField[] = [
  'createdAt',
  'preferredDate',
  'status',
] as const;

export const DEFAULT_INQUIRY_LIST_SORT: InquiryListSortOptions = {
  field: 'createdAt',
  dir: 'desc',
};

/** 0=미제출, 1=입금완료, 2=입금대기, 3=대기, 4=본문(필터 결과) */
export type InquiryListPinTier = 0 | 1 | 2 | 3 | 4;

/** 열별 첫 클릭 기본 방향 */
export function defaultInquiryListSortDir(field: InquiryListSortField): InquiryListSortDir {
  if (field === 'createdAt') return 'desc';
  return 'asc';
}

export function parseInquiryListSortQuery(
  sortBy: unknown,
  sortDir: unknown,
): InquiryListSortOptions {
  const field =
    typeof sortBy === 'string' &&
    (INQUIRY_LIST_SORT_FIELDS as readonly string[]).includes(sortBy)
      ? (sortBy as InquiryListSortField)
      : DEFAULT_INQUIRY_LIST_SORT.field;
  const dir = sortDir === 'asc' || sortDir === 'desc' ? sortDir : DEFAULT_INQUIRY_LIST_SORT.dir;
  return { field, dir };
}

export type InquiryListSortable = {
  status: string;
  createdAt: string | Date;
  preferredDate?: string | Date | null;
  happyCallCompletedAt?: string | Date | null;
  orderForm?: {
    submittedAt?: string | Date | null;
    createdAt?: string | Date | null;
  } | null;
};

/** 발주서 링크 발급·고객 미제출 — ORDER_FORM_PENDING 및 레거시(PENDING/입금완료+미제출 발주서) */
export function isInquiryOrderFormPendingSubmit(row: InquiryListSortable): boolean {
  if (row.status === 'ORDER_FORM_PENDING') return true;
  return Boolean(
    row.orderForm &&
      !row.orderForm.submittedAt &&
      (row.status === 'PENDING' || row.status === 'DEPOSIT_COMPLETED'),
  );
}

/**
 * 목록 상단 pin tier — 미제출 우선, 그다음 입금완료·입금대기·대기, 그 외 본문.
 */
export function inquiryListSortTier(row: InquiryListSortable): InquiryListPinTier {
  if (isInquiryOrderFormPendingSubmit(row)) return 0;
  if (row.status === 'DEPOSIT_COMPLETED') return 1;
  if (row.status === 'DEPOSIT_PENDING') return 2;
  if (row.status === 'PENDING') return 3;
  return 4;
}

/** 날짜·상태 필터와 무관하게 목록 최상단에 고정되는 처리 전 접수 */
export function isInquiryListPinnedPreReceive(row: InquiryListSortable): boolean {
  return inquiryListSortTier(row) < 4;
}

function toSortMs(d: string | Date | null | undefined): number | null {
  if (d == null) return null;
  const t = d instanceof Date ? d.getTime() : Date.parse(String(d));
  return Number.isFinite(t) ? t : null;
}

/** null·미정은 항상 맨 아래 */
function compareNullableMs(aMs: number | null, bMs: number | null, dir: InquiryListSortDir): number {
  if (aMs == null && bMs == null) return 0;
  if (aMs == null) return 1;
  if (bMs == null) return -1;
  const diff = aMs - bMs;
  return dir === 'asc' ? diff : -diff;
}

function compareByField(
  a: InquiryListSortable,
  b: InquiryListSortable,
  options: InquiryListSortOptions,
): number {
  const { field, dir } = options;
  if (field === 'createdAt') {
    return compareNullableMs(toSortMs(a.createdAt), toSortMs(b.createdAt), dir);
  }
  if (field === 'preferredDate') {
    return compareNullableMs(toSortMs(a.preferredDate), toSortMs(b.preferredDate), dir);
  }
  const sa = String(a.status ?? '');
  const sb = String(b.status ?? '');
  const cmp = sa.localeCompare(sb, 'ko');
  return dir === 'asc' ? cmp : -cmp;
}

export function compareInquiryListSortable(
  a: InquiryListSortable,
  b: InquiryListSortable,
  options: InquiryListSortOptions = DEFAULT_INQUIRY_LIST_SORT,
): number {
  const tierA = inquiryListSortTier(a);
  const tierB = inquiryListSortTier(b);
  if (tierA !== tierB) return tierA - tierB;
  const primary = compareByField(a, b, options);
  if (primary !== 0) return primary;
  return compareNullableMs(toSortMs(b.createdAt), toSortMs(a.createdAt), 'desc');
}

/** 안정 정렬 — 동일 tier·키가면 API 순서 유지 */
export function sortInquiryListRows<T extends InquiryListSortable>(
  rows: T[],
  options: InquiryListSortOptions = DEFAULT_INQUIRY_LIST_SORT,
): T[] {
  return rows
    .map((row, idx) => ({ row, idx }))
    .sort((a, b) => {
      const cmp = compareInquiryListSortable(a.row, b.row, options);
      return cmp !== 0 ? cmp : a.idx - b.idx;
    })
    .map((x) => x.row);
}
