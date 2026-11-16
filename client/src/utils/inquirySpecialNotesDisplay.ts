/** 발주서 고객 특이사항(OrderForm.customerSpecialNotes)과 접수 내부 메모(Inquiry.specialNotes)는 서로 대체하지 않는다. */

export type InquiryNotesOrderFormSlice = {
  id?: string;
  customerSpecialNotes?: string | null;
  submittedAt?: string | null;
} | null | undefined;

export function effectiveCustomerOrderNotes(params: {
  specialNotes?: string | null;
  orderForm?: InquiryNotesOrderFormSlice;
}): string {
  return params.orderForm?.customerSpecialNotes?.trim() ?? '';
}

export function effectiveAdminTeamSpecialNotes(params: {
  specialNotes?: string | null;
  orderForm?: InquiryNotesOrderFormSlice;
}): string {
  return (params.specialNotes ?? '').trim();
}

/** 접수 메모 + 관리자·팀 공유 `specialNotes` — 팀장·타업체에 함께 노출할 관리자 측 문구(중복 시 한 번만) */
export function effectiveTeamSharedAdminNotes(params: {
  memo?: string | null;
  specialNotes?: string | null;
  orderForm?: InquiryNotesOrderFormSlice;
}): string {
  const memo = (params.memo ?? '').trim();
  const sn = effectiveAdminTeamSpecialNotes({
    specialNotes: params.specialNotes,
    orderForm: params.orderForm,
  });
  if (!memo && !sn) return '';
  if (!memo) return sn;
  if (!sn) return memo;
  if (memo === sn) return memo;
  return `${memo}\n\n──\n\n${sn}`;
}
