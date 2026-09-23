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

const AIRCON_ORDER_FORM_TEMPLATE_TITLE = '에어컨 청소 발주서';

/** 에어컨 양식에는 입주/이사 종류를 받지 않는다. */
export function shouldCollectOrderFormCleaningKind(
  template?: { title?: string | null; isDefault?: boolean | null } | null,
): boolean {
  if (!template || template.isDefault) return true;
  return (template.title?.trim() ?? '') !== AIRCON_ORDER_FORM_TEMPLATE_TITLE;
}
