/** 현장 촬영 — 개수를 늘리거나 줄일 수 있는 표준 구역(방·현관·욕실·베란다) */
import { normalizeAreaKeyForTemplate } from './inquiryInspectionTenantTemplate.js';

export const COUNTABLE_INSPECTION_AREA_TEMPLATE_KEYS = [
  'room',
  'entrance',
  'bathroom',
  'balcony',
] as const;

export type CountableInspectionAreaTemplateKey =
  (typeof COUNTABLE_INSPECTION_AREA_TEMPLATE_KEYS)[number];

const COUNTABLE_SET = new Set<string>(COUNTABLE_INSPECTION_AREA_TEMPLATE_KEYS);

export const MAX_INSPECTION_AREA_INSTANCES = 8;

const INSTANCE_LABEL_BASE: Record<CountableInspectionAreaTemplateKey, string> = {
  room: '방',
  entrance: '현관',
  bathroom: '욕실',
  balcony: '베란다',
};

export function isCountableInspectionAreaKey(areaKey: string): boolean {
  return COUNTABLE_SET.has(normalizeAreaKeyForTemplate(areaKey));
}

export function parseAreaInstanceNumber(areaKey: string, templateKey: string): number {
  if (templateKey === 'room') {
    const m = areaKey.match(/^room_(\d+)$/);
    return m ? parseInt(m[1]!, 10) : 1;
  }
  if (areaKey === templateKey) return 1;
  const m = areaKey.match(new RegExp(`^${templateKey}_(\\d+)$`));
  return m ? parseInt(m[1]!, 10) : 1;
}

export function buildAreaInstanceKey(
  templateKey: CountableInspectionAreaTemplateKey,
  instanceNum: number,
): string {
  if (templateKey === 'room') return `room_${instanceNum}`;
  return instanceNum === 1 ? templateKey : `${templateKey}_${instanceNum}`;
}

export function buildAreaInstanceLabel(
  templateKey: CountableInspectionAreaTemplateKey,
  instanceIndex: number,
  total: number,
): string {
  const base = INSTANCE_LABEL_BASE[templateKey];
  if (total <= 1) return base;
  return `${base} ${instanceIndex}`;
}

export function nextAreaInstanceNumber(
  areaKeys: ReadonlyArray<string>,
  templateKey: CountableInspectionAreaTemplateKey,
): number {
  let max = 0;
  for (const key of areaKeys) {
    if (normalizeAreaKeyForTemplate(key) !== templateKey) continue;
    max = Math.max(max, parseAreaInstanceNumber(key, templateKey));
  }
  return max + 1;
}
