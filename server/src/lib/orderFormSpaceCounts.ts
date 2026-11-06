/**
 * @see shared/orderFormSpaceCounts.ts (클라이언트와 동기화)
 */
export const ORDER_FORM_SPACE_COUNT_FIELDS = [
  { key: 'roomCount', label: '방' },
  { key: 'balconyCount', label: '베란다' },
  { key: 'bathroomCount', label: '화장실' },
  { key: 'kitchenCount', label: '주방' },
] as const;

export type OrderFormSpaceCountKey = (typeof ORDER_FORM_SPACE_COUNT_FIELDS)[number]['key'];

export const ORDER_FORM_SPACE_COUNT_REQUIRED_KEYS: readonly OrderFormSpaceCountKey[] = [
  'roomCount',
  'bathroomCount',
];

export const ORDER_FORM_SPACE_COUNT_DEFAULT_ZERO_KEYS: readonly OrderFormSpaceCountKey[] = [
  'balconyCount',
  'kitchenCount',
];

export const ORDER_FORM_SPACE_COUNT_HINT =
  '방·화장실은 필수입니다. 베란다·주방은 없으면 0으로 두세요.';

export function parseOrderFormSpaceCount(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number') {
    if (!Number.isInteger(raw) || raw < 0) return null;
    return raw;
  }
  const s = String(raw).trim();
  if (s === '') return null;
  const n = Number(s);
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

/** 입력 내용 — 방·발코니·화장실·주방을 한 줄로 */
export function formatOrderFormSpaceCountsLine(counts: {
  roomCount?: number | string | null;
  balconyCount?: number | string | null;
  bathroomCount?: number | string | null;
  kitchenCount?: number | string | null;
}): string {
  const n = (value: number | string | null | undefined) =>
    value == null || value === '' ? '—' : String(value);
  return `방 ${n(counts.roomCount)} · 발코니 ${n(counts.balconyCount)} · 화장실 ${n(counts.bathroomCount)} · 주방 ${n(counts.kitchenCount)}`;
}

export function validateOrderFormSpaceCountFields(
  source: Record<string, unknown>,
): Partial<Record<OrderFormSpaceCountKey, string>> {
  const errors: Partial<Record<OrderFormSpaceCountKey, string>> = {};
  for (const { key, label } of ORDER_FORM_SPACE_COUNT_FIELDS) {
    const raw = source[key];
    const empty = raw == null || String(raw).trim() === '';
    if (ORDER_FORM_SPACE_COUNT_DEFAULT_ZERO_KEYS.includes(key)) {
      if (empty) continue;
      if (parseOrderFormSpaceCount(raw) === null) {
        errors[key] = `「${label}」 개수를 확인해 주세요.`;
      }
      continue;
    }
    if (parseOrderFormSpaceCount(raw) === null) {
      errors[key] = `「${label}」 개수를 입력해 주세요.`;
    }
  }
  return errors;
}

export function validateOrderFormSpaceCounts(source: Record<string, unknown>): string | null {
  const fieldErrors = validateOrderFormSpaceCountFields(source);
  const first = ORDER_FORM_SPACE_COUNT_FIELDS.map(({ key }) => fieldErrors[key]).find(Boolean);
  return first ?? null;
}

export function coerceOrderFormSpaceCounts(source: {
  roomCount?: unknown;
  balconyCount?: unknown;
  bathroomCount?: unknown;
  kitchenCount?: unknown;
}): {
  roomCount: number | null;
  balconyCount: number | null;
  bathroomCount: number | null;
  kitchenCount: number | null;
} {
  const balconyRaw = source.balconyCount;
  const kitchenRaw = source.kitchenCount;
  const balconyEmpty = balconyRaw == null || String(balconyRaw).trim() === '';
  const kitchenEmpty = kitchenRaw == null || String(kitchenRaw).trim() === '';
  return {
    roomCount: parseOrderFormSpaceCount(source.roomCount),
    bathroomCount: parseOrderFormSpaceCount(source.bathroomCount),
    balconyCount: balconyEmpty ? 0 : parseOrderFormSpaceCount(balconyRaw),
    kitchenCount: kitchenEmpty ? 0 : parseOrderFormSpaceCount(kitchenRaw),
  };
}
