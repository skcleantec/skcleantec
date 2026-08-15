const STORAGE_KEY = 'crm.aiSummary.fontScale';
const PRESET_STORAGE_KEY = 'crm.aiSummary.fontPresetId';
const MIN = 0.5;
const MAX = 1.0;
const STEP = 0.05;
export const CRM_AI_FONT_SCALE_DEFAULT = 0.625;

/** AI 정리 패널 전체에 적용하는 글자 크기 프리셋 */
export const CRM_AI_FONT_SCALE_PRESETS = [
  { id: 'sm', label: '작게', scale: 0.55 },
  { id: 'md', label: '보통', scale: CRM_AI_FONT_SCALE_DEFAULT },
  { id: 'lg', label: '크게', scale: 0.75 },
  { id: 'xl', label: '아주 크게', scale: 0.875 },
] as const;

export type CrmAiFontPresetId = (typeof CRM_AI_FONT_SCALE_PRESETS)[number]['id'];

export function clampCrmAiFontScale(value: number): number {
  return Math.min(MAX, Math.max(MIN, Math.round(value / STEP) * STEP));
}

export function readCrmAiFontScale(): number {
  try {
    const presetId = localStorage.getItem(PRESET_STORAGE_KEY) as CrmAiFontPresetId | null;
    if (presetId) {
      const preset = CRM_AI_FONT_SCALE_PRESETS.find((p) => p.id === presetId);
      if (preset) return preset.scale;
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    const n = raw != null ? Number(raw) : NaN;
    if (Number.isFinite(n) && n >= MIN && n <= MAX) return clampCrmAiFontScale(n);
  } catch {
    /* ignore */
  }
  return CRM_AI_FONT_SCALE_DEFAULT;
}

export function writeCrmAiFontScale(value: number): number {
  const clamped = clampCrmAiFontScale(value);
  try {
    localStorage.setItem(STORAGE_KEY, String(clamped));
    localStorage.setItem(PRESET_STORAGE_KEY, resolveCrmAiFontPresetId(clamped));
  } catch {
    /* ignore */
  }
  return clamped;
}

export function crmAiFontPercent(scale: number): number {
  return Math.round((scale / CRM_AI_FONT_SCALE_DEFAULT) * 100);
}

export function resolveCrmAiFontPresetId(scale: number): CrmAiFontPresetId {
  const exact = CRM_AI_FONT_SCALE_PRESETS.find((p) => p.scale === scale);
  if (exact) return exact.id;
  let best: (typeof CRM_AI_FONT_SCALE_PRESETS)[number] = CRM_AI_FONT_SCALE_PRESETS[1];
  let bestDist = Infinity;
  for (const preset of CRM_AI_FONT_SCALE_PRESETS) {
    const dist = Math.abs(preset.scale - scale);
    if (dist < bestDist) {
      bestDist = dist;
      best = preset;
    }
  }
  return best.id;
}

/** 드롭다운 선택 시 preset id 기준으로 저장 (작게/보통 등이 정확히 반영되도록) */
export function writeCrmAiFontScalePreset(id: CrmAiFontPresetId): number {
  const preset = CRM_AI_FONT_SCALE_PRESETS.find((p) => p.id === id);
  const scale = preset?.scale ?? CRM_AI_FONT_SCALE_DEFAULT;
  try {
    localStorage.setItem(PRESET_STORAGE_KEY, id);
    localStorage.setItem(STORAGE_KEY, String(scale));
  } catch {
    /* ignore */
  }
  return scale;
}
