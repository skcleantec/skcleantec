/** 발주서 고객 특이사항 vs 접수 특이사항(관리자·팀 공유) 표시 분리 — 구데이터는 고객 내용이 접수 `specialNotes`에만 있을 수 있음 */

export type InquiryNotesOrderFormSlice = {
  id?: string;
  customerSpecialNotes?: string | null;
  submittedAt?: string | null;
} | null | undefined;

export function effectiveCustomerOrderNotes(params: {
  specialNotes?: string | null;
  orderForm?: InquiryNotesOrderFormSlice;
}): string {
  const fromForm = params.orderForm?.customerSpecialNotes?.trim();
  if (fromForm) return fromForm;
  const of = params.orderForm;
  if (of?.id && of.submittedAt) {
    const legacy = params.specialNotes?.trim();
    if (legacy) return legacy;
  }
  return '';
}

export function effectiveAdminTeamSpecialNotes(params: {
  specialNotes?: string | null;
  orderForm?: InquiryNotesOrderFormSlice;
}): string {
  const of = params.orderForm;
  const legacy =
    Boolean(of?.id && of.submittedAt) &&
    !of?.customerSpecialNotes?.trim() &&
    Boolean(params.specialNotes?.trim());
  if (legacy) return '';
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
