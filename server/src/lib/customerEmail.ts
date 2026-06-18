/** 고객 이메일 정규화·검증 (발주서·견적서·검수 공통) */
export function normalizeCustomerEmail(raw: unknown): string {
  if (raw == null) return '';
  return String(raw).trim().toLowerCase();
}

export function isValidCustomerEmail(email: string): boolean {
  const t = email.trim();
  if (!t || t.length > 320) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

export function assertValidCustomerEmail(raw: unknown, fieldLabel = '이메일'): string {
  const email = normalizeCustomerEmail(raw);
  if (!email) {
    throw Object.assign(new Error('customer_email_required'), {
      message: `${fieldLabel}을(를) 입력해 주세요.`,
    });
  }
  if (!isValidCustomerEmail(email)) {
    throw Object.assign(new Error('customer_email_invalid'), {
      message: `${fieldLabel} 형식이 올바르지 않습니다.`,
    });
  }
  return email;
}
