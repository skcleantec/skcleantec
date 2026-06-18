/**
 * 발주서 링크만 발급하고 고객 미제출인 접수에 DB NOT NULL 대응으로 넣는 내부 표식 주소.
 * 고객·운영 화면의 실제 주소로 취급하면 안 된다.
 */
export const ORDER_FORM_PENDING_PLACEHOLDER_ADDRESS = '(발주서 링크 발급)';

export function isOrderFormPendingPlaceholderAddress(
  address: string | null | undefined,
): boolean {
  return (address ?? '').trim() === ORDER_FORM_PENDING_PLACEHOLDER_ADDRESS;
}

/** 고객 제출·접수 확정에 쓸 수 있는 주소인지 */
export function isRealCustomerAddress(address: string | null | undefined): boolean {
  const t = (address ?? '').trim();
  return t.length > 0 && !isOrderFormPendingPlaceholderAddress(t);
}

/** 이 상태들에서는 플레이스홀더·빈 주소를 허용(미제출·대기 전용) */
export const INQUIRY_STATUSES_ALLOWING_PLACEHOLDER_ADDRESS = [
  'ORDER_FORM_PENDING',
  'PENDING',
  'DEPOSIT_PENDING',
  'DEPOSIT_COMPLETED',
] as const;

export type InquiryStatusAllowingPlaceholderAddress =
  (typeof INQUIRY_STATUSES_ALLOWING_PLACEHOLDER_ADDRESS)[number];

export function validateInquiryAddressForStatus(
  status: string,
  address: string | null | undefined,
): string | null {
  if (
    (INQUIRY_STATUSES_ALLOWING_PLACEHOLDER_ADDRESS as readonly string[]).includes(status)
  ) {
    return null;
  }
  if (!isRealCustomerAddress(address)) {
    return '주소를 입력해 주세요. 발주서 미제출 건은 고객이 제출한 뒤 접수로 전환하거나, 주소를 직접 입력해 주세요.';
  }
  return null;
}

/** 고객 발주서 폼·관리 편집 초기값 — 플레이스홀더는 빈 칸으로 */
export function customerFormAddressFromInquiry(
  address: string | null | undefined,
): string {
  if (isOrderFormPendingPlaceholderAddress(address)) return '';
  return (address ?? '').trim();
}
