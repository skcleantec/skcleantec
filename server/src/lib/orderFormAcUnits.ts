/**
 * @generated-sync from shared/orderFormAcUnits.ts — 직접 수정하지 마세요.
 * 변경: shared/orderFormAcUnits.ts 수정 후 동기화.
 */

export const ORDER_FORM_AC_UNITS_FIELD_KEY = 'ac_units';

export const ORDER_FORM_AC_UNIT_TYPE_OPTIONS = [
  '벽걸이',
  '스탠드',
  '천장형 1·2way',
  '천장형 4way',
  '2in1 세트',
  '원형(360°) 천장형',
  '실외기 추가',
] as const;

export type AcUnitRow = {
  type: string;
  count: number;
};

const LEGACY_AC_COUNT_FIELD_KEYS = [
  'ac_wall_mount_count',
  'ac_stand_count',
  'ac_system_1way_2way_count',
  'ac_system_4way_count',
  'ac_2in1_count',
  'ac_round_360_count',
  'ac_outdoor_unit_count',
] as const;

export const ORDER_FORM_AC_LEGACY_COUNT_FIELD_KEYS: readonly string[] = LEGACY_AC_COUNT_FIELD_KEYS;

function parseCount(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(0, Math.floor(raw));
  const n = parseInt(String(raw ?? '').replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function parseAcUnitsAnswer(raw: unknown): AcUnitRow[] {
  if (raw == null) return [];
  let src: unknown[] = [];
  if (Array.isArray(raw)) {
    src = raw;
  } else if (typeof raw === 'string') {
    const t = raw.trim();
    if (!t) return [];
    try {
      const parsed = JSON.parse(t) as unknown;
      if (Array.isArray(parsed)) src = parsed;
    } catch {
      return [];
    }
  } else {
    return [];
  }

  const out: AcUnitRow[] = [];
  for (const item of src.slice(0, 30)) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const type = String(row.type ?? row.unitType ?? '').trim();
    const count = parseCount(row.count);
    if (!type || count <= 0) continue;
    out.push({ type, count });
  }
  return out;
}

export function normalizeAcUnitsAnswer(raw: unknown): AcUnitRow[] {
  return parseAcUnitsAnswer(raw).map((r) => ({
    type: r.type.slice(0, 64),
    count: Math.min(99, r.count),
  }));
}

export function isAcUnitsAnswerEmpty(raw: unknown): boolean {
  return normalizeAcUnitsAnswer(raw).length === 0;
}

export function formatAcUnitsSummary(rows: AcUnitRow[]): string {
  return rows.map((r) => `${r.type} ${r.count}대`).join(', ');
}

export function formatAcUnitsSnapshotValue(raw: unknown): string {
  return formatAcUnitsSummary(normalizeAcUnitsAnswer(raw));
}
