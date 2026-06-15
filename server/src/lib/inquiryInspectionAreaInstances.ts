/**
 * @generated-sync from shared/inquiryInspectionAreaInstances.ts — 직접 수정하지 마세요.
 * 변경: shared/inquiryInspectionAreaInstances.ts 수정 후 `npm run sync:inquiry-inspection-shared` (prebuild/predev 자동).
 */

import { normalizeAreaKeyForTemplate } from './inquiryInspectionTenantTemplate.js';

export const COUNTABLE_INSPECTION_AREA_TEMPLATE_KEYS = [
  'entrance',
  'living',
  'kitchen',
  'room',
  'bathroom',
  'balcony',
  'utility',
] as const;

export type CountableInspectionAreaTemplateKey =
  (typeof COUNTABLE_INSPECTION_AREA_TEMPLATE_KEYS)[number];

const COUNTABLE_SET = new Set<string>(COUNTABLE_INSPECTION_AREA_TEMPLATE_KEYS);

export const MAX_INSPECTION_AREA_INSTANCES = 8;

const INSTANCE_LABEL_BASE: Record<CountableInspectionAreaTemplateKey, string> = {
  entrance: '현관',
  living: '거실',
  kitchen: '주방',
  room: '방',
  bathroom: '욕실',
  balcony: '베란다',
  utility: '다용도실',
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
