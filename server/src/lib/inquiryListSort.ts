/**
 * @generated-sync from shared/inquiryListSort.ts — 직접 수정하지 마세요.
 * 변경: shared/inquiryListSort.ts 수정 후 `npm run sync:inquiry-list-sort` (prebuild/predev 자동).
 */

export type InquiryListSortable = {
  status: string;
  createdAt: string | Date;
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

export function isInquiryCancelUnconfirmed(row: InquiryListSortable): boolean {
  return row.status === 'CANCELLED' && !row.happyCallCompletedAt;
}

/** 0=미제출 최상단, 1=미확인 취소, 2=예약완료 외, 3=예약완료(RECEIVED) */
export function inquiryListSortTier(row: InquiryListSortable): number {
  if (isInquiryOrderFormPendingSubmit(row)) return 0;
  if (isInquiryCancelUnconfirmed(row)) return 1;
  if (row.status !== 'RECEIVED') return 2;
  return 3;
}

function toSortMs(d: string | Date | null | undefined): number {
  if (!d) return 0;
  const t = d instanceof Date ? d.getTime() : Date.parse(String(d));
  return Number.isFinite(t) ? t : 0;
}

export function compareInquiryListSortable(a: InquiryListSortable, b: InquiryListSortable): number {
  const tierA = inquiryListSortTier(a);
  const tierB = inquiryListSortTier(b);
  if (tierA !== tierB) return tierA - tierB;
  return toSortMs(b.createdAt) - toSortMs(a.createdAt);
}

/** 안정 정렬 — 동일 tier·시각이면 API 순서 유지 */
export function sortInquiryListRows<T extends InquiryListSortable>(rows: T[]): T[] {
  return rows
    .map((row, idx) => ({ row, idx }))
    .sort((a, b) => {
      const cmp = compareInquiryListSortable(a.row, b.row);
      return cmp !== 0 ? cmp : a.idx - b.idx;
    })
    .map((x) => x.row);
}
