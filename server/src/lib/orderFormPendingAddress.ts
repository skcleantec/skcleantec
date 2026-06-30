/**
 * 발주서 링크만 발급하고 고객 미제출인 접수에 DB NOT NULL 대응으로 넣는 내부 표식 주소.
 * @see shared/orderFormPendingAddress.ts (클라이언트와 동기화)
 */
export const ORDER_FORM_PENDING_PLACEHOLDER_ADDRESS = '(발주서 링크 발급)';

/** 관리자 수기(간편) 등록 — 고객 주소 미입력 시 DB·목록용 내부 표식 */
export const MANUAL_INTAKE_PLACEHOLDER_ADDRESS = '주소 미입력';

export function isOrderFormPendingPlaceholderAddress(
  address: string | null | undefined,
): boolean {
  return (address ?? '').trim() === ORDER_FORM_PENDING_PLACEHOLDER_ADDRESS;
}

export function isManualIntakePlaceholderAddress(
  address: string | null | undefined,
): boolean {
  return (address ?? '').trim() === MANUAL_INTAKE_PLACEHOLDER_ADDRESS;
}

/** 구 `외부업체…` 출처와 신규 `수기등록` — 간편 등록(필수 항목 생략) 플로우 */
export function isManualIntakeSource(source: string | null | undefined): boolean {
  const s = source ?? '';
  return s.includes('외부업체') || s.includes('수기등록');
}

export function isRealCustomerAddress(address: string | null | undefined): boolean {
  const t = (address ?? '').trim();
  return (
    t.length > 0 &&
    !isOrderFormPendingPlaceholderAddress(t) &&
    !isManualIntakePlaceholderAddress(t)
  );
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
  opts?: { source?: string | null },
): string | null {
  if (isManualIntakeSource(opts?.source)) {
    return null;
  }
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
  if (isManualIntakePlaceholderAddress(address)) return '';
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
