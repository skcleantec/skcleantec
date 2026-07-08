/** 텔레CRM 숨고 메시지 프리셋 — 스텝 시퀀스 (브릿지·서버·CRM 공유) */

export type SoomgoMessageImageMode = 'bundle' | 'single';

export type SoomgoMessageStep =
  | { type: 'text'; text: string }
  | { type: 'images'; urls: string[]; mode: SoomgoMessageImageMode };

export type SoomgoMessagePresetDto = {
  id: string;
  /** 레거시 호환 — 신규 프리셋은 0, 정렬은 sortOrder 기준 */
  slotNumber: number;
  label: string;
  steps: SoomgoMessageStep[];
  sortOrder: number;
  isActive: boolean;
  ownerUserId: string | null;
  ownerScope: 'shared' | 'personal';
};

/** 사용자(또는 공유 카탈로그)당 프리셋 상한 */
export const SOOMGO_MESSAGE_PRESET_MAX = 100;

export const SOOMGO_MESSAGE_STEP_LIMIT = 20;
export const SOOMGO_MESSAGE_TEXT_MAX = 4000;
export const SOOMGO_MESSAGE_IMAGES_PER_STEP_MAX = 10;

export function isSoomgoMessageStep(value: unknown): value is SoomgoMessageStep {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  if (row.type === 'text') {
    return typeof row.text === 'string' && row.text.trim().length > 0;
  }
  if (row.type === 'images') {
    const urls = row.urls;
    const mode = row.mode;
    return (
      Array.isArray(urls) &&
      urls.length > 0 &&
      urls.every((u) => typeof u === 'string' && /^https:\/\//i.test(u.trim())) &&
      (mode === 'bundle' || mode === 'single')
    );
  }
  return false;
}

export function parseSoomgoMessageSteps(raw: unknown): SoomgoMessageStep[] | null {
  if (!Array.isArray(raw)) return null;
  if (raw.length === 0 || raw.length > SOOMGO_MESSAGE_STEP_LIMIT) return null;
  const steps: SoomgoMessageStep[] = [];
  for (const item of raw) {
    if (!isSoomgoMessageStep(item)) return null;
    if (item.type === 'text') {
      const text = item.text.trim().slice(0, SOOMGO_MESSAGE_TEXT_MAX);
      if (!text) return null;
      steps.push({ type: 'text', text });
      continue;
    }
    const urls = item.urls
      .map((u) => u.trim())
      .filter(Boolean)
      .slice(0, SOOMGO_MESSAGE_IMAGES_PER_STEP_MAX);
    if (!urls.length) return null;
    steps.push({ type: 'images', urls, mode: item.mode });
  }
  return steps;
}
