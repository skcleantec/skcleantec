/**
 * @see shared/orderFormCleaningKind.ts (클라이언트와 동기화)
 */

export const ORDER_FORM_CLEANING_KIND_VALUES = [
  'MOVE_IN',
  'MOVE',
  'HANDOVER',
  'OCCUPIED',
  'SPECIAL',
] as const;

export type OrderFormCleaningKind = (typeof ORDER_FORM_CLEANING_KIND_VALUES)[number];

export const ORDER_FORM_CLEANING_KIND_FIELD_KEY = 'cleaningKind';

export const ORDER_FORM_CLEANING_KIND_LABEL = '청소 종류';

const KIND_SET = new Set<string>(ORDER_FORM_CLEANING_KIND_VALUES);

const KIND_LABELS: Record<OrderFormCleaningKind, string> = {
  MOVE_IN: '입주청소',
  MOVE: '이사청소',
  HANDOVER: '준공청소',
  OCCUPIED: '거주청소',
  SPECIAL: '특수청소',
};

export function parseOrderFormCleaningKind(raw: unknown): OrderFormCleaningKind | null {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim().toUpperCase();
  return KIND_SET.has(s) ? (s as OrderFormCleaningKind) : null;
}

export function labelForCleaningKind(raw: unknown): string {
  const parsed = parseOrderFormCleaningKind(raw);
  if (!parsed) return raw == null || raw === '' ? '—' : String(raw);
  return KIND_LABELS[parsed];
}

/** 기본 입주청소 발주서에만 종류·안내 그림을 받는다. */
export function shouldCollectOrderFormCleaningKind(
  template?: { isDefault?: boolean | null } | null,
): boolean {
  return template?.isDefault === true;
}
