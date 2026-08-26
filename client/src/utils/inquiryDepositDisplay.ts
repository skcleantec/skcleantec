/** 접수·스케줄 — 예약금 있음/없음/미정 (금액 기준, 상태와 별개) */

export type InquiryDepositSource = {
  serviceDepositAmount?: number | null;
  orderForm?: { depositAmount?: number | null } | null;
};

export function resolveInquiryDepositAmount(item: InquiryDepositSource): number | null {
  const raw = item.serviceDepositAmount ?? item.orderForm?.depositAmount ?? null;
  if (raw == null) return null;
  if (!Number.isFinite(Number(raw))) return null;
  return Math.round(Number(raw));
}

/** 예약금 > 0 → yes, 명시 0 → no, 미입력 → unknown */
export type InquiryDepositPresence = 'yes' | 'no' | 'unknown';

export function inquiryDepositPresence(item: InquiryDepositSource): InquiryDepositPresence {
  const deposit = resolveInquiryDepositAmount(item);
  if (deposit == null) return 'unknown';
  if (deposit > 0) return 'yes';
  return 'no';
}

export function inquiryHasDeposit(item: InquiryDepositSource): boolean {
  return inquiryDepositPresence(item) === 'yes';
}

export function inquiryHasNoDeposit(item: InquiryDepositSource): boolean {
  return inquiryDepositPresence(item) === 'no';
}
