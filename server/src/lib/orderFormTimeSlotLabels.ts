/**
 * @generated-sync from shared/orderFormTimeSlotLabels.ts — 직접 수정하지 마세요.
 */
/** 발주서·접수 시간대 — 저장값 3개 고정, 표시 라벨만 테넌트별 설정 */

export const ORDER_TIME_SLOT_VALUES = ['오전', '오후', '사이청소'] as const;

export type OrderTimeSlot = (typeof ORDER_TIME_SLOT_VALUES)[number];

export const DEFAULT_ORDER_TIME_SLOT_LABELS: Record<OrderTimeSlot, string> = {
  오전: '오전 (8시~9시 시작)',
  오후: '오후 (12시~14시 시작)',
  사이청소: '사이청소(상담내용 동일기재)',
};

export type OrderTimeSlotLabels = Record<OrderTimeSlot, string>;

/** DB `time_slot_labels_json` — 키는 3값 중 일부만 있어도 됨 */
export type OrderTimeSlotLabelsJson = Partial<Record<OrderTimeSlot, string>>;

export function isOrderTimeSlotValue(value: string): value is OrderTimeSlot {
  return (ORDER_TIME_SLOT_VALUES as readonly string[]).includes(value);
}

export function resolveOrderTimeSlotLabels(
  partial?: OrderTimeSlotLabelsJson | null,
): OrderTimeSlotLabels {
  const out: OrderTimeSlotLabels = { ...DEFAULT_ORDER_TIME_SLOT_LABELS };
  if (!partial || typeof partial !== 'object') return out;
  for (const key of ORDER_TIME_SLOT_VALUES) {
    const v = partial[key];
    if (typeof v === 'string' && v.trim()) out[key] = v.trim();
  }
  return out;
}

export function buildOrderTimeSlotOptions(labels?: OrderTimeSlotLabelsJson | OrderTimeSlotLabels | null) {
  const resolved = resolveOrderTimeSlotLabels(labels);
  return ORDER_TIME_SLOT_VALUES.map((value) => ({
    value,
    label: resolved[value],
  }));
}

export function labelForTimeSlotFromLabels(
  value: string | null | undefined,
  labels?: OrderTimeSlotLabelsJson | OrderTimeSlotLabels | null,
): string {
  if (value == null || value === '') return '—';
  if (isOrderTimeSlotValue(value)) {
    return resolveOrderTimeSlotLabels(labels)[value];
  }
  return value;
}

/** 목록용 짧은 표기: 오전 / 오후 / 사이 */
export function shortTimeSlotLabelFromLabels(
  value: string | null | undefined,
  _labels?: OrderTimeSlotLabelsJson | OrderTimeSlotLabels | null,
): string {
  if (value == null || value === '') return '-';
  if (value === '사이청소') return '사이';
  if (value === '오전' || value === '오후') return value;
  if (isOrderTimeSlotValue(value)) {
    return value === '사이청소' ? '사이' : value;
  }
  return value;
}

export function parseOrderTimeSlotLabelsJson(raw: unknown): OrderTimeSlotLabelsJson | null {
  if (raw == null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const out: OrderTimeSlotLabelsJson = {};
  for (const key of ORDER_TIME_SLOT_VALUES) {
    const v = o[key];
    if (typeof v === 'string' && v.trim()) out[key] = v.trim();
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** PUT 저장용 — 3키 모두 non-empty, 기본값과 동일하면 null(미설정) */
export function sanitizeOrderTimeSlotLabelsJsonForSave(raw: unknown): OrderTimeSlotLabelsJson | null {
  if (raw == null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('시간대 표시 문구 형식이 올바르지 않습니다.');
  }
  const o = raw as Record<string, unknown>;
  const out: OrderTimeSlotLabelsJson = {};
  for (const key of ORDER_TIME_SLOT_VALUES) {
    const v = o[key];
    if (v == null || (typeof v === 'string' && !v.trim())) {
      throw new Error(`${key} 시간대 표시 문구를 입력해 주세요.`);
    }
    if (typeof v !== 'string') {
      throw new Error('시간대 표시 문구 형식이 올바르지 않습니다.');
    }
    out[key] = v.trim();
  }
  const resolved = resolveOrderTimeSlotLabels(out);
  const allDefault = ORDER_TIME_SLOT_VALUES.every(
    (k) => resolved[k] === DEFAULT_ORDER_TIME_SLOT_LABELS[k],
  );
  return allDefault ? null : out;
}

/** 일괄등록 — value·커스텀 라벨·기존 휴리스틱 */
export function resolvePreferredTimeFromExcelWithLabels(
  raw: string,
  labels?: OrderTimeSlotLabelsJson | OrderTimeSlotLabels | null,
): string | null {
  const s = raw.trim();
  if (!s) return null;

  if (isOrderTimeSlotValue(s)) return s;

  const resolved = resolveOrderTimeSlotLabels(labels);
  for (const key of ORDER_TIME_SLOT_VALUES) {
    if (s === resolved[key]) return key;
  }

  const lower = s.toLowerCase();
  if (s.includes('사이') || lower === 'between') return '사이청소';
  if (s.includes('오전') || lower === 'am' || s.includes('上午')) return '오전';
  if (s.includes('오후') || lower === 'pm' || s.includes('下午')) return '오후';

  return null;
}
