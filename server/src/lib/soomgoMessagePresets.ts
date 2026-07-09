/** @see shared/soomgoMessagePresets.ts — 클라이언트와 로직 동기화 */

export type SoomgoMessageImageMode = 'bundle' | 'single';

export type SoomgoMessageStep =
  | { type: 'text'; text: string }
  | { type: 'images'; urls: string[]; mode: SoomgoMessageImageMode };

const STEP_LIMIT = 20;
const TEXT_MAX = 4000;
const IMAGES_PER_STEP_MAX = 10;

/** @see shared/soomgoMessagePresets.ts SOOMGO_MESSAGE_PRESET_MAX */
export const SOOMGO_MESSAGE_PRESET_MAX = 100;

function isStep(value: unknown): value is SoomgoMessageStep {
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
  if (raw.length === 0 || raw.length > STEP_LIMIT) return null;
  const steps: SoomgoMessageStep[] = [];
  for (const item of raw) {
    if (!isStep(item)) return null;
    if (item.type === 'text') {
      const text = item.text.trim().slice(0, TEXT_MAX);
      if (!text) return null;
      steps.push({ type: 'text', text });
      continue;
    }
    const urls = item.urls
      .map((u) => u.trim())
      .filter(Boolean)
      .slice(0, IMAGES_PER_STEP_MAX);
    if (!urls.length) return null;
    steps.push({ type: 'images', urls, mode: item.mode });
  }
  return steps;
}

/** @see shared/soomgoMessagePresets.ts */
export type SoomgoAutoTriggerKind = 'auto_absent' | 'auto_hold';

export const SOOMGO_AUTO_TRIGGER_KINDS: SoomgoAutoTriggerKind[] = ['auto_absent', 'auto_hold'];

export const SOOMGO_AUTO_TRIGGER_LABELS: Record<SoomgoAutoTriggerKind, string> = {
  auto_absent: '부재',
  auto_hold: '보류·고민',
};

export function isSoomgoAutoTriggerKind(value: unknown): value is SoomgoAutoTriggerKind {
  return value === 'auto_absent' || value === 'auto_hold';
}
