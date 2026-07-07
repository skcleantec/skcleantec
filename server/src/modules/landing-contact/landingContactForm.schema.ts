/** 랜딩·외부 페이지 문의 — 서버 상수 (shared/landingContactForm.ts 와 동기) */
export const LANDING_CONTACT_INQUIRY_STATUSES = ['NEW', 'CONTACTED', 'CONVERTED', 'CLOSED'] as const;

export type LandingContactCustomFieldDef = {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'tel' | 'email' | 'number' | 'select';
  required?: boolean;
  placeholder?: string;
  options?: string[];
};

const LANDING_CONTACT_PROPERTY_TYPE_OPTIONS = ['아파트', '오피스텔', '빌라(연립)', '상가', '기타'];

export const DEFAULT_LANDING_CONTACT_CUSTOM_FIELDS: LandingContactCustomFieldDef[] = [
  {
    key: 'area_pyeong',
    label: '평수',
    type: 'number',
    required: true,
    placeholder: '예: 33',
  },
  {
    key: 'property_type',
    label: '건축물 유형',
    type: 'select',
    required: true,
    options: [...LANDING_CONTACT_PROPERTY_TYPE_OPTIONS],
  },
];

const FIELD_KEY_RE = /^[a-z][a-z0-9_]{0,47}$/;
const ALLOWED_TYPES = new Set(['text', 'textarea', 'tel', 'email', 'number', 'select']);

function parseFieldOptions(raw: unknown, type: string): string[] | undefined {
  if (type !== 'select') return undefined;
  if (!Array.isArray(raw)) return undefined;
  const options = raw
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
    .slice(0, 50);
  return options.length > 0 ? options : undefined;
}

export function parseLandingContactCustomFields(raw: unknown): LandingContactCustomFieldDef[] {
  if (!Array.isArray(raw)) return [];
  const out: LandingContactCustomFieldDef[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const key = typeof o.key === 'string' ? o.key.trim().toLowerCase() : '';
    const label = typeof o.label === 'string' ? o.label.trim() : '';
    const type = typeof o.type === 'string' ? o.type.trim() : 'text';
    if (!key || !FIELD_KEY_RE.test(key) || !label || !ALLOWED_TYPES.has(type)) continue;
    const options = parseFieldOptions(o.options, type);
    if (type === 'select' && !options?.length) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      key,
      label,
      type: type as LandingContactCustomFieldDef['type'],
      required: o.required === true,
      placeholder: typeof o.placeholder === 'string' ? o.placeholder.trim() || undefined : undefined,
      options,
    });
    if (out.length >= 20) break;
  }
  return out;
}

/** DB에 항목이 없으면 기본(평수·건축물 유형)을 사용 */
export function resolveLandingContactCustomFields(raw: unknown): LandingContactCustomFieldDef[] {
  const parsed = parseLandingContactCustomFields(raw);
  return parsed.length > 0 ? parsed : DEFAULT_LANDING_CONTACT_CUSTOM_FIELDS;
}

export function validateLandingContactCustomFieldValues(
  fields: LandingContactCustomFieldDef[],
  raw: unknown,
): { ok: true; values: Record<string, string> } | { ok: false; error: string } {
  const input =
    raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const values: Record<string, string> = {};
  for (const field of fields) {
    const rawVal = input[field.key];
    const str = rawVal == null ? '' : String(rawVal).trim();
    if (field.required && !str) {
      return { ok: false, error: `${field.label}을(를) 입력해 주세요.` };
    }
    if (str) {
      if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str)) {
        return { ok: false, error: `${field.label} 형식이 올바르지 않습니다.` };
      }
      if (field.type === 'number' && !Number.isFinite(Number(str))) {
        return { ok: false, error: `${field.label}에 숫자를 입력해 주세요.` };
      }
      if (field.type === 'select' && field.options?.length && !field.options.includes(str)) {
        return { ok: false, error: `${field.label}을(를) 선택해 주세요.` };
      }
      values[field.key] = str.slice(0, 2000);
    }
  }
  for (const [k, v] of Object.entries(input)) {
    if (fields.some((f) => f.key === k)) continue;
    if (typeof v === 'string' && v.trim()) {
      return { ok: false, error: '허용되지 않은 항목이 포함되어 있습니다.' };
    }
  }
  return { ok: true, values };
}

export function formatCustomFieldsForInquiryMemo(
  fields: LandingContactCustomFieldDef[],
  values: Record<string, string>,
): string {
  const lines: string[] = [];
  for (const field of fields) {
    const v = values[field.key];
    if (v) lines.push(`${field.label}: ${v}`);
  }
  return lines.join('\n');
}
