/**
 * @generated-sync from shared/inquiryInspectionTenantTemplate.ts — 직접 수정하지 마세요.
 * 변경: shared/inquiryInspectionTenantTemplate.ts 수정 후 `npm run sync:inquiry-inspection-shared` (prebuild/predev 자동).
 */

import type { InspectionItemDef } from './inquiryInspectionItems.js';
import { buildStandardItemsForAreaKey } from './inquiryInspectionItems.js';

export const INSPECTION_TEMPLATE_AREA_CATALOG: ReadonlyArray<{
  templateKey: string;
  label: string;
}> = [
  { templateKey: 'entrance', label: '현관' },
  { templateKey: 'living', label: '거실' },
  { templateKey: 'kitchen', label: '주방' },
  { templateKey: 'room', label: '방 (room_1, room_2 …)' },
  { templateKey: 'bathroom', label: '욕실' },
  { templateKey: 'balcony', label: '베란다' },
  { templateKey: 'utility', label: '다용도실' },
];

export type TenantInspectionAreaItems = Record<string, InspectionItemDef[]>;

export type TenantInspectionTemplateConfig = {
  /** templateKey → 세부 항목. 미설정 구역은 시스템 기본 사용 */
  areaItems?: TenantInspectionAreaItems;
};

const ITEM_KEY_RE = /^[a-z][a-z0-9_]{0,63}$/;
const MAX_ITEMS_PER_AREA = 60;
const MAX_ITEM_LABEL = 120;

const VALID_TEMPLATE_KEYS = new Set(INSPECTION_TEMPLATE_AREA_CATALOG.map((a) => a.templateKey));

export function normalizeAreaKeyForTemplate(areaKey: string): string {
  if (areaKey.startsWith('room_')) return 'room';
  if (areaKey === 'entrance' || areaKey.startsWith('entrance_')) return 'entrance';
  if (areaKey === 'bathroom' || areaKey.startsWith('bathroom_')) return 'bathroom';
  if (areaKey === 'balcony' || areaKey.startsWith('balcony_')) return 'balcony';
  return areaKey;
}

export function getDefaultItemsForTemplateKey(templateKey: string): InspectionItemDef[] {
  if (templateKey === 'room') return buildStandardItemsForAreaKey('room_1');
  return buildStandardItemsForAreaKey(templateKey);
}

/** 접수 체크리스트 구역 areaKey 기준 적용 항목 (테넌트 오버라이드 → 시스템 기본) */
export function resolveInspectionItemsForArea(
  areaKey: string,
  template?: TenantInspectionTemplateConfig | null,
): InspectionItemDef[] {
  const templateKey = normalizeAreaKeyForTemplate(areaKey);
  const custom = template?.areaItems?.[templateKey];
  if (custom?.length) {
    return custom.map((it) => ({ itemKey: it.itemKey, label: it.label }));
  }
  return getDefaultItemsForTemplateKey(templateKey);
}

export function buildDefaultTenantTemplateSnapshot(): TenantInspectionAreaItems {
  const out: TenantInspectionAreaItems = {};
  for (const { templateKey } of INSPECTION_TEMPLATE_AREA_CATALOG) {
    out[templateKey] = getDefaultItemsForTemplateKey(templateKey);
  }
  return out;
}

function itemsEqual(a: InspectionItemDef[], b: InspectionItemDef[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((it, i) => it.itemKey === b[i]?.itemKey && it.label === b[i]?.label);
}

/** 저장 시 기본과 동일한 구역은 제외해 areaItems 경량화 */
export function compactTenantInspectionAreaItems(
  areaItems: TenantInspectionAreaItems,
): TenantInspectionAreaItems | undefined {
  const defaults = buildDefaultTenantTemplateSnapshot();
  const out: TenantInspectionAreaItems = {};
  for (const [key, items] of Object.entries(areaItems)) {
    if (!VALID_TEMPLATE_KEYS.has(key)) continue;
    const def = defaults[key];
    if (!def || itemsEqual(items, def)) continue;
    out[key] = items;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** DB·API PATCH body 검증 */
export function sanitizeTenantInspectionAreaItems(raw: unknown): TenantInspectionAreaItems {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('areaItems는 객체여야 합니다.');
  }
  const out: TenantInspectionAreaItems = {};
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!VALID_TEMPLATE_KEYS.has(key)) continue;
    if (!Array.isArray(val)) {
      throw new Error(`${key} 구역 항목은 배열이어야 합니다.`);
    }
    const items: InspectionItemDef[] = [];
    const seen = new Set<string>();
    for (const row of val) {
      if (!row || typeof row !== 'object') continue;
      const o = row as Record<string, unknown>;
      const itemKey = typeof o.itemKey === 'string' ? o.itemKey.trim() : '';
      const label = typeof o.label === 'string' ? o.label.trim() : '';
      if (!ITEM_KEY_RE.test(itemKey)) {
        throw new Error(`항목 키 "${itemKey}"는 영문 소문자·숫자·_ 만 사용할 수 있습니다.`);
      }
      if (!label) throw new Error('항목 이름을 입력해 주세요.');
      if (label.length > MAX_ITEM_LABEL) {
        throw new Error(`항목 이름은 ${MAX_ITEM_LABEL}자 이하여야 합니다.`);
      }
      if (seen.has(itemKey)) {
        throw new Error(`구역 ${key}에 중복 항목 키 "${itemKey}"가 있습니다.`);
      }
      seen.add(itemKey);
      items.push({ itemKey, label: label.slice(0, MAX_ITEM_LABEL) });
      if (items.length > MAX_ITEMS_PER_AREA) {
        throw new Error(`구역당 항목은 ${MAX_ITEMS_PER_AREA}개까지입니다.`);
      }
    }
    if (items.length === 0) {
      throw new Error(`${key} 구역에 항목이 1개 이상 필요합니다.`);
    }
    out[key] = items;
  }
  return out;
}

export function mergeEffectiveInspectionTemplate(
  custom: TenantInspectionAreaItems | null | undefined,
): TenantInspectionAreaItems {
  const defaults = buildDefaultTenantTemplateSnapshot();
  if (!custom) return defaults;
  return { ...defaults, ...custom };
}
