/** @see shared/platformBillingNotifyEmails.ts — 동기화 */

export const PAYMENT_NOTIFY_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isPaymentNotifyEmailValid(email: string): boolean {
  return PAYMENT_NOTIFY_EMAIL_PATTERN.test(email.trim());
}

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

export function parsePaymentNotifyEmailsFromSettings(
  row: PaymentNotifyEmailSettingsRow,
): string[] {
  const fromJson = normalizePaymentNotifyEmails(row.dunningPaymentNotifyEmails);
  if (fromJson.length > 0) return fromJson;
  const legacy = row.dunningPaymentNotifyEmail?.trim();
  if (legacy && isPaymentNotifyEmailValid(legacy)) return [legacy.toLowerCase()];
  return [];
}

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
