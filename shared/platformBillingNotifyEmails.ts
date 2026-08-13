/** 입금 확인 알림 수신 이메일 — 형식·정규화 (클라·서버 공통) */

export const PAYMENT_NOTIFY_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isPaymentNotifyEmailValid(email: string): boolean {
  return PAYMENT_NOTIFY_EMAIL_PATTERN.test(email.trim());
}

/** 유효한 이메일만 남기고 중복 제거 (소문자) */
export function normalizePaymentNotifyEmails(raw: unknown): string[] {
  const out: string[] = [];
  const add = (email: string) => {
    const trimmed = email.trim();
    if (!trimmed || !isPaymentNotifyEmailValid(trimmed)) return;
    const lower = trimmed.toLowerCase();
    if (!out.includes(lower)) out.push(lower);
  };
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === 'string') add(item);
    }
  }
  return out;
}

export type PaymentNotifyEmailSettingsRow = {
  dunningPaymentNotifyEmails?: unknown;
  dunningPaymentNotifyEmail?: string | null;
};

/** DB 행 → 수신 이메일 목록 (JSON 배열 우선, 레거시 단일 컬럼 폴백) */
export function parsePaymentNotifyEmailsFromSettings(
  row: PaymentNotifyEmailSettingsRow,
): string[] {
  const fromJson = normalizePaymentNotifyEmails(row.dunningPaymentNotifyEmails);
  if (fromJson.length > 0) return fromJson;
  const legacy = row.dunningPaymentNotifyEmail?.trim();
  if (legacy && isPaymentNotifyEmailValid(legacy)) return [legacy.toLowerCase()];
  return [];
}

/** 저장 전 검증 — 잘못된 항목이 있으면 메시지 반환 */
export function validatePaymentNotifyEmailInput(raw: unknown): string | null {
  if (!Array.isArray(raw)) return '알림 이메일 목록 형식이 올바르지 않습니다.';
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (trimmed && !isPaymentNotifyEmailValid(trimmed)) {
      return '입금 확인 알림 받을 이메일 형식을 확인해 주세요.';
    }
  }
  return null;
}
