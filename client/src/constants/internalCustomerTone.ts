export type InternalCustomerTone = 'GOOD' | 'NORMAL' | 'BAD';

export const INTERNAL_CUSTOMER_TONE_OPTIONS: ReadonlyArray<{
  value: InternalCustomerTone;
  emoji: string;
  label: string;
}> = [
  { value: 'GOOD', emoji: '😊', label: '좋은 고객' },
  { value: 'NORMAL', emoji: '😐', label: '보통 고객' },
  { value: 'BAD', emoji: '😠', label: '악성 고객' },
] as const;

export const DEFAULT_INTERNAL_CUSTOMER_TONE: InternalCustomerTone = 'NORMAL';

export function normalizeInternalCustomerTone(raw: unknown): InternalCustomerTone {
  const s = String(raw ?? '').trim().toUpperCase();
  if (s === 'GOOD' || s === 'BAD') return s;
  return 'NORMAL';
}

export function internalCustomerToneEmoji(tone: InternalCustomerTone | null | undefined): string {
  const t = normalizeInternalCustomerTone(tone);
  return INTERNAL_CUSTOMER_TONE_OPTIONS.find((o) => o.value === t)?.emoji ?? '😐';
}

/** 마케터·관리자 화면 — 고객명 옆 이모티콘 */
export function canShowInternalCustomerTone(role: string | undefined | null): boolean {
  return role === 'ADMIN' || role === 'MARKETER';
}
