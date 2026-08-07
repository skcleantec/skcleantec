import { effectiveCustomerOrderNotes } from './inquirySpecialNotesDisplay';

/** 접수 목록 — 고객 발주 특이사항 O/X (관리자·팀 specialNotes 제외) */
export function inquiryListHasCustomerSpecialNotes(item: {
  specialNotes?: string | null;
  orderForm?: {
    id?: string;
    customerSpecialNotes?: string | null;
    submittedAt?: string | null;
  } | null;
}): boolean {
  return Boolean(
    effectiveCustomerOrderNotes({
      specialNotes: item.specialNotes,
      orderForm: item.orderForm,
    }),
  );
}

/** 접수 목록 — 발주서 고객 첨부 사진 O/X */
export function inquiryListHasOrderFormPhotos(
  orderFormPhotoCount: number | null | undefined,
): boolean {
  return (orderFormPhotoCount ?? 0) > 0;
}
