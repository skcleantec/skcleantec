/**
 * 발주서 링크만 발급하고 고객 미제출인 접수에 DB NOT NULL 대응으로 넣는 내부 표식 주소.
 * @see shared/orderFormPendingAddress.ts (클라이언트와 동기화)
 */
export const ORDER_FORM_PENDING_PLACEHOLDER_ADDRESS = '(발주서 링크 발급)';

export function isOrderFormPendingPlaceholderAddress(
  address: string | null | undefined,
): boolean {
  return (address ?? '').trim() === ORDER_FORM_PENDING_PLACEHOLDER_ADDRESS;
}

export function isRealCustomerAddress(address: string | null | undefined): boolean {
  const t = (address ?? '').trim();
  return t.length > 0 && !isOrderFormPendingPlaceholderAddress(t);
}

export const INQUIRY_STATUSES_ALLOWING_PLACEHOLDER_ADDRESS = [
  'ORDER_FORM_PENDING',
  'PENDING',
  'DEPOSIT_PENDING',
  'DEPOSIT_COMPLETED',
] as const;

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

export function customerFormAddressFromInquiry(
  address: string | null | undefined,
): string {
  if (isOrderFormPendingPlaceholderAddress(address)) return '';
  return (address ?? '').trim();
}

export function isMarketerLockedOrderFormAddress(prefill: unknown): boolean {
  if (!prefill || typeof prefill !== 'object') return false;
  const raw = (prefill as Record<string, unknown>).address;
  if (typeof raw !== 'string') return false;
  return isRealCustomerAddress(raw);
}

export function parseAddressSelectedViaSearchFlag(raw: unknown): boolean {
  return raw === true || raw === 'true' || String(raw ?? '') === '1';
}
