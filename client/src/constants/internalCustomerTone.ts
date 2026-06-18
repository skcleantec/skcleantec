export type InternalCustomerTone = 'GOOD' | 'NORMAL' | 'BAD';

/** 라디오에 노출 — GOOD·BAD만 (NORMAL은 «선택 없음») */
export const INTERNAL_CUSTOMER_TONE_OPTIONS: ReadonlyArray<{
  value: Exclude<InternalCustomerTone, 'NORMAL'>;
  emoji: string;
  label: string;
}> = [
  { value: 'GOOD', emoji: '👼', label: '좋은 고객' },
  { value: 'BAD', emoji: '😈', label: '악성 고객' },
] as const;

/** 폼 기본 — 미선택(이모티콘 없음, DB에는 NORMAL) */
export const DEFAULT_INTERNAL_CUSTOMER_TONE: InternalCustomerTone = 'NORMAL';

export function normalizeInternalCustomerTone(raw: unknown): InternalCustomerTone {
  const s = String(raw ?? '').trim().toUpperCase();
  if (s === 'GOOD' || s === 'BAD') return s;
  return 'NORMAL';
}

/** 목록·고객명 옆 — NORMAL·미설정이면 빈 문자열 */
export function internalCustomerToneEmoji(tone: InternalCustomerTone | null | undefined): string {
  if (tone === 'GOOD') return '👼';
  if (tone === 'BAD') return '😈';
  return '';
}

/** API 전송 — GOOD·BAD만, 미선택은 undefined */
export function internalCustomerToneForApi(
  tone: InternalCustomerTone | null | undefined,
): 'GOOD' | 'BAD' | undefined {
  if (tone === 'GOOD' || tone === 'BAD') return tone;
  return undefined;
}

export function hasInternalCustomerToneDisplay(
  tone: InternalCustomerTone | null | undefined,
): boolean {
  return tone === 'GOOD' || tone === 'BAD';
}

/** 마케터·관리자 화면 — 고객명 옆 이모티콘 */
export function canShowInternalCustomerTone(role: string | undefined | null): boolean {
  return role === 'ADMIN' || role === 'MARKETER';
}
