import { isAirconOrderFormTemplate, type OrderFormTemplateKindInput } from './orderFormServiceKind';

/** 고객 발주서 1페이지 — 청소 종류(건축물 유형과 별개) */

export const ORDER_FORM_CLEANING_KIND_VALUES = [
  'MOVE_IN',
  'MOVE',
  'HANDOVER',
  'OCCUPIED',
  'SPECIAL',
] as const;

export type OrderFormCleaningKind = (typeof ORDER_FORM_CLEANING_KIND_VALUES)[number];

/** customerAnswers · prefillAnswers 예약 키 */
export const ORDER_FORM_CLEANING_KIND_FIELD_KEY = 'cleaningKind';

export const ORDER_FORM_CLEANING_KIND_LABEL = '청소 종류';

export const ORDER_FORM_CLEANING_KIND_OPTIONS: {
  value: OrderFormCleaningKind;
  label: string;
  hint: string;
  imageSrc: string;
}[] = [
  {
    value: 'MOVE_IN',
    label: '입주청소',
    hint: '짐 없는 빈 집 (기본)',
    imageSrc: '/orderform/cleaning-kind/move-in.jpg',
  },
  {
    value: 'MOVE',
    label: '이사청소',
    hint: '짐이 들어오는 날',
    imageSrc: '/orderform/cleaning-kind/move.jpg',
  },
  {
    value: 'HANDOVER',
    label: '준공청소',
    hint: '공사 잔재가 있는 현장',
    imageSrc: '/orderform/cleaning-kind/handover.jpg',
  },
  {
    value: 'OCCUPIED',
    label: '거주청소',
    hint: '짐이 있는 집',
    imageSrc: '/orderform/cleaning-kind/occupied.jpg',
  },
  {
    value: 'SPECIAL',
    label: '특수청소',
    hint: '일반 청소로 안 되는 현장',
    imageSrc: '/orderform/cleaning-kind/special.jpg',
  },
];

const KIND_SET = new Set<string>(ORDER_FORM_CLEANING_KIND_VALUES);

export function parseOrderFormCleaningKind(raw: unknown): OrderFormCleaningKind | null {
  if (raw == null || raw === '') return null;
  const s = String(raw).trim().toUpperCase();
  return KIND_SET.has(s) ? (s as OrderFormCleaningKind) : null;
}

export function isOrderFormCleaningKind(raw: unknown): raw is OrderFormCleaningKind {
  return parseOrderFormCleaningKind(raw) != null;
}

export function labelForCleaningKind(raw: unknown): string {
  const parsed = parseOrderFormCleaningKind(raw);
  if (!parsed) return raw == null || raw === '' ? '—' : String(raw);
  return ORDER_FORM_CLEANING_KIND_OPTIONS.find((o) => o.value === parsed)?.label ?? parsed;
}

export function cleaningKindOption(raw: unknown) {
  const parsed = parseOrderFormCleaningKind(raw);
  if (!parsed) return null;
  return ORDER_FORM_CLEANING_KIND_OPTIONS.find((o) => o.value === parsed) ?? null;
}

/** 에어컨 양식에는 입주/이사 종류를 받지 않는다. */
export function shouldCollectOrderFormCleaningKind(template?: OrderFormTemplateKindInput): boolean {
  return !isAirconOrderFormTemplate(template);
}
