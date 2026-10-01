/** 발주서·접수 시간대 — 기본 4칸. 실제 선택지는 발주서(양식) preferredTime.options 가 우선. */

export const ORDER_TIME_SLOT_VALUES = ['오전', '오후', '사이청소', '조율'] as const;

export type OrderTimeSlot = (typeof ORDER_TIME_SLOT_VALUES)[number];

export const DEFAULT_ORDER_TIME_SLOT_LABELS: Record<OrderTimeSlot, string> = {
  오전: '오전 (8시~9시 시작)',
  오후: '오후 (12시~14시 시작)',
  사이청소: '사이청소(상담내용 동일기재)',
  조율: '조율 (오전·오후·사이 무관, 마지막 배치)',
};

/** 고객 발주서 시간대 질문. DB `time_slot_labels_json.questionTitle` */
export const DEFAULT_ORDER_TIME_SLOT_QUESTION = '오전·오후 중 언제가 좋으세요?';

export const ORDER_TIME_SLOT_QUESTION_MAX = 120;

export type OrderTimeSlotLabels = Record<OrderTimeSlot, string>;

/** DB `time_slot_labels_json` — 키는 4값 중 일부만 있어도 됨 */
export type OrderTimeSlotLabelsJson = Partial<Record<OrderTimeSlot, string>>;

/** 저장 JSON — 표시 라벨 + 고객 질문 문장 */
export type OrderTimeSlotConfigJson = OrderTimeSlotLabelsJson & {
  questionTitle?: string;
};

export function isOrderTimeSlotValue(value: string): value is OrderTimeSlot {
  const s = value.trim().normalize('NFC');
  return (ORDER_TIME_SLOT_VALUES as readonly string[]).includes(s);
}

/** 표시 문구·엑셀 표기를 오전·오후·사이청소·조율 저장값으로 맞춤 */
export function resolvePreferredTimeSlotForDetail(
  raw: string | null | undefined,
  labels?: OrderTimeSlotLabelsJson | OrderTimeSlotLabels | null,
): OrderTimeSlot | null {
  const s = String(raw ?? '').trim().normalize('NFC');
  if (!s) return null;
  if ((ORDER_TIME_SLOT_VALUES as readonly string[]).includes(s)) return s as OrderTimeSlot;
  const fromLabel = resolvePreferredTimeFromExcelWithLabels(s, labels);
  return fromLabel && (ORDER_TIME_SLOT_VALUES as readonly string[]).includes(fromLabel)
    ? (fromLabel as OrderTimeSlot)
    : null;
}

export function canonicalizeTimeSlotOptionValue(
  raw: string,
  labels?: OrderTimeSlotLabelsJson | OrderTimeSlotLabels | null,
): string {
  const s = raw.trim().normalize('NFC');
  if (!s) return s;
  return resolvePreferredTimeSlotForDetail(s, labels) ?? s;
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
  _labels?: OrderTimeSlotLabelsJson | OrderTimeSlotLabels | null,
): string[] {
  const field = systemFields?.find((x) => x.systemField === 'preferredTime');
  return sanitizeTimeSlotOptionList(field?.options);
}

/**
 * 손님·발급 시간대 선택지.
 * 양식 하위 항목이 있으면 버튼 글자는 그 문구 그대로.
 * 저장값은 오전·오후·사이청소·조율로 맞추고, 항목이 없으면 기본 4칸 표시 문구를 쓴다.
 */
export function buildTimeSlotOptionsForForm(
  templateOptions?: string[] | null,
  tenantLabels?: OrderTimeSlotLabelsJson | OrderTimeSlotLabels | null,
): { value: string; label: string }[] {
  const raw = sanitizeTimeSlotOptionList(templateOptions);
  const resolved = resolveOrderTimeSlotLabels(tenantLabels);
  if (raw.length === 0) {
    return ORDER_TIME_SLOT_VALUES.map((value) => ({
      value,
      label: resolved[value],
    }));
  }
  const used = new Set<string>();
  return raw.map((text) => {
    const canonical = resolvePreferredTimeSlotForDetail(text, tenantLabels);
    let value = canonical ?? text;
    if (used.has(value)) value = text;
    used.add(value);
    return { value, label: text };
  });
}

/** 이 발주서에서 고를 수 있는 시간대인지 */
export function isAllowedPreferredTimeValue(
  value: string,
  templateOptions?: string[] | null,
  labels?: OrderTimeSlotLabelsJson | OrderTimeSlotLabels | null,
): boolean {
  const s = String(value ?? '').trim().normalize('NFC');
  if (!s) return false;
  const rawOpts = sanitizeTimeSlotOptionList(templateOptions);
  const custom = rawOpts.map((v) => canonicalizeTimeSlotOptionValue(v, labels));
  const canonical = resolvePreferredTimeSlotForDetail(s, labels);
  const sCanon = canonicalizeTimeSlotOptionValue(s, labels);
  if (custom.length === 0) {
    return canonical != null;
  }
  if (custom.includes(s) || custom.includes(sCanon)) return true;
  if (canonical != null && custom.includes(canonical)) return true;
  return rawOpts.some((opt) => {
    const o = opt.trim().normalize('NFC');
    if (o === s || o === sCanon) return true;
    const optCanon = resolvePreferredTimeSlotForDetail(opt, labels);
    return Boolean(optCanon && (optCanon === s || optCanon === sCanon || optCanon === canonical));
  });
}

export function labelForTimeSlotFromLabels(
  value: string | null | undefined,
  labels?: OrderTimeSlotLabelsJson | OrderTimeSlotLabels | null,
): string {
  if (value == null || value === '') return '—';
  if (value === '종일') return '종일';
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
  if (value === '종일') return '종일';
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

/** 기본 질문과 같거나 비어 있으면 null */
export function parseOrderTimeSlotQuestionTitle(raw: unknown): string | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const v = (raw as Record<string, unknown>).questionTitle;
  if (typeof v !== 'string') return null;
  const t = v.trim().slice(0, ORDER_TIME_SLOT_QUESTION_MAX);
  if (!t || t === DEFAULT_ORDER_TIME_SLOT_QUESTION) return null;
  return t;
}

export function resolveOrderTimeSlotQuestionTitle(raw: unknown): string {
  return parseOrderTimeSlotQuestionTitle(raw) ?? DEFAULT_ORDER_TIME_SLOT_QUESTION;
}

/** PUT 저장용 — 4키 모두 non-empty. 라벨·질문이 모두 기본이면 null */
export function sanitizeOrderTimeSlotLabelsJsonForSave(raw: unknown): OrderTimeSlotConfigJson | null {
  if (raw == null) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('시간대 표시 문구 형식이 올바르지 않습니다.');
  }
  const o = raw as Record<string, unknown>;
  const out: OrderTimeSlotConfigJson = {};
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
  const questionTitle = parseOrderTimeSlotQuestionTitle(o);
  const resolved = resolveOrderTimeSlotLabels(out);
  const allDefault = ORDER_TIME_SLOT_VALUES.every(
    (k) => resolved[k] === DEFAULT_ORDER_TIME_SLOT_LABELS[k],
  );
  if (allDefault) return questionTitle ? { questionTitle } : null;
  if (questionTitle) out.questionTitle = questionTitle;
  return out;
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
