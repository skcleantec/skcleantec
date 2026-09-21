/**
 * @generated-sync from shared/orderFormTimeSlotLabels.ts — 직접 수정하지 마세요.
 */
/** 발주서·접수 시간대 — 기본 4칸. 실제 선택지는 발주서(양식) preferredTime.options 가 우선. */

export const ORDER_TIME_SLOT_VALUES = ['오전', '오후', '사이청소', '조율'] as const;

export type OrderTimeSlot = (typeof ORDER_TIME_SLOT_VALUES)[number];

export const DEFAULT_ORDER_TIME_SLOT_LABELS: Record<OrderTimeSlot, string> = {
  오전: '오전 (8시~9시 시작)',
  오후: '오후 (12시~14시 시작)',
  사이청소: '사이청소(상담내용 동일기재)',
  조율: '조율 (오전·오후·사이 무관, 마지막 배치)',
};

export type OrderTimeSlotLabels = Record<OrderTimeSlot, string>;

/** DB `time_slot_labels_json` — 키는 4값 중 일부만 있어도 됨 */
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

/** 발주서 칸에 적힌 시간대 하위 항목 — 빈칸·중복 제거 */
export function sanitizeTimeSlotOptionList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const s = String(item ?? '').trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

export function preferredTimeOptionsFromTemplateFields(
  systemFields?: Array<{ systemField?: string | null; options?: unknown }> | null,
): string[] {
  const field = systemFields?.find((x) => x.systemField === 'preferredTime');
  return sanitizeTimeSlotOptionList(field?.options);
}

/**
 * 손님·발급 시간대 선택지.
 * 양식에 하위 항목이 있으면 그것만. 없으면 기본 4칸.
 * 저장값이 오전·오후·사이청소·조율이면 업체 표시 문구를 붙인다.
 */
export function buildTimeSlotOptionsForForm(
  templateOptions?: string[] | null,
  tenantLabels?: OrderTimeSlotLabelsJson | OrderTimeSlotLabels | null,
): { value: string; label: string }[] {
  const custom = sanitizeTimeSlotOptionList(templateOptions);
  const values = custom.length > 0 ? custom : [...ORDER_TIME_SLOT_VALUES];
  const resolved = resolveOrderTimeSlotLabels(tenantLabels);
  return values.map((value) => ({
    value,
    label: isOrderTimeSlotValue(value) ? resolved[value] : value,
  }));
}

/** 이 발주서에서 고를 수 있는 시간대인지 */
export function isAllowedPreferredTimeValue(
  value: string,
  templateOptions?: string[] | null,
): boolean {
  const s = value.trim();
  if (!s) return false;
  const custom = sanitizeTimeSlotOptionList(templateOptions);
  if (custom.length > 0) return custom.includes(s);
  return isOrderTimeSlotValue(s);
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

/** 목록용 짧은 표기: 오전 / 오후 / 사이 / 조율 */
export function shortTimeSlotLabelFromLabels(
  value: string | null | undefined,
  _labels?: OrderTimeSlotLabelsJson | OrderTimeSlotLabels | null,
): string {
  if (value == null || value === '') return '-';
  if (value === '사이청소') return '사이';
  if (value === '조율') return '조율';
  if (value === '오전' || value === '오후') return value;
  if (isOrderTimeSlotValue(value)) {
    if (value === '사이청소') return '사이';
    if (value === '조율') return '조율';
    return value;
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

/** PUT 저장용 — 4키 모두 non-empty, 기본값과 동일하면 null(미설정) */
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
  if (s.includes('조율') || lower === 'coordination') return '조율';
  if (s.includes('사이') || lower === 'between') return '사이청소';
  if (s.includes('오전') || lower === 'am' || s.includes('上午')) return '오전';
  if (s.includes('오후') || lower === 'pm' || s.includes('下午')) return '오후';

  return null;
}
