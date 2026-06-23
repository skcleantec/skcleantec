export type InternalCustomerTone = 'GOOD' | 'NORMAL' | 'BAD' | 'ELDERLY';

/** 라디오에 노출 — GOOD·BAD·ELDERLY (NORMAL은 «선택 없음») */
export const INTERNAL_CUSTOMER_TONE_OPTIONS: ReadonlyArray<{
  value: Exclude<InternalCustomerTone, 'NORMAL'>;
  emoji: string;
  label: string;
}> = [
  { value: 'GOOD', emoji: '👼', label: '좋은 고객' },
  { value: 'BAD', emoji: '😈', label: '악성 고객' },
  { value: 'ELDERLY', emoji: '🧓', label: '어르신 (전화 확인)' },
] as const;

/** 폼 기본 — 미선택(이모티콘 없음, DB에는 NORMAL) */
export const DEFAULT_INTERNAL_CUSTOMER_TONE: InternalCustomerTone = 'NORMAL';

const DISPLAY_TONES = new Set<InternalCustomerTone>(['GOOD', 'BAD', 'ELDERLY']);

export function normalizeInternalCustomerTone(raw: unknown): InternalCustomerTone {
  const s = String(raw ?? '').trim().toUpperCase();
  if (s === 'GOOD' || s === 'BAD' || s === 'ELDERLY') return s;
  return 'NORMAL';
}

/** 목록·고객명 옆 — NORMAL·미설정이면 빈 문자열 */
export function internalCustomerToneEmoji(tone: InternalCustomerTone | null | undefined): string {
  if (tone === 'GOOD') return '👼';
  if (tone === 'BAD') return '😈';
  if (tone === 'ELDERLY') return '🧓';
  return '';
}

/** 호버·스크린리더 보조 — 이모티콘만 보이는 목록용 */
export function internalCustomerToneHint(tone: InternalCustomerTone | null | undefined): string {
  if (tone === 'GOOD') return '좋은 고객';
  if (tone === 'BAD') return '악성 고객';
  if (tone === 'ELDERLY') return '어르신 — 전화로 정보 재확인 권장';
  return '';
}

/** API 전송 — GOOD·BAD·ELDERLY만, 미선택은 undefined */
export function internalCustomerToneForApi(
  tone: InternalCustomerTone | null | undefined,
): Exclude<InternalCustomerTone, 'NORMAL'> | undefined {
  if (tone === 'GOOD' || tone === 'BAD' || tone === 'ELDERLY') return tone;
  return undefined;
}

export function hasInternalCustomerToneDisplay(
  tone: InternalCustomerTone | null | undefined,
): boolean {
  return !!tone && DISPLAY_TONES.has(tone);
}

/** 마케터·관리자 화면 — 고객명 옆 이모티콘 */
export function canShowInternalCustomerTone(role: string | undefined | null): boolean {
  return role === 'ADMIN' || role === 'MARKETER';
}
