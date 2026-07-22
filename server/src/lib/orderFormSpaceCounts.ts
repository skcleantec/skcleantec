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

export const ORDER_FORM_SPACE_COUNT_HINT =
  '청소가 필요없는 부분은 [ 0 ] 으로 표시해주세요.';

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

export function validateOrderFormSpaceCounts(source: Record<string, unknown>): string | null {
  for (const { key, label } of ORDER_FORM_SPACE_COUNT_FIELDS) {
    if (parseOrderFormSpaceCount(source[key]) === null) {
      return `「${label}」 개수를 입력해 주세요. ${ORDER_FORM_SPACE_COUNT_HINT}`;
    }
  }
  return null;
}
