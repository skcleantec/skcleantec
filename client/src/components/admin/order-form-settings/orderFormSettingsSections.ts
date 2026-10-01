export const ORDER_FORM_SETTINGS_SECTIONS = [
  'basics',
  'fields',
  'guide',
  'copy',
  'price',
  'specialty',
  'leadSource',
] as const;

export type OrderFormSettingsSectionId = (typeof ORDER_FORM_SETTINGS_SECTIONS)[number];

export const ORDER_FORM_SETTINGS_SECTION_LABELS: Record<OrderFormSettingsSectionId, string> = {
  basics: '이름·사용',
  fields: '입력 칸',
  guide: '안내·동의',
  copy: '손님 문구',
  price: '금액·견적',
  specialty: '전문시공',
  leadSource: '유입경로',
};

const OPEN_BY_DEFAULT: OrderFormSettingsSectionId[] = ['basics', 'fields', 'guide'];

/** 예전 탭 `panel=` → 새 섹션 */
const LEGACY_PANEL_TO_SECTION: Record<string, OrderFormSettingsSectionId> = {
  title: 'copy',
  price: 'price',
  review: 'copy',
  footer: 'copy',
  success: 'copy',
  timeAck: 'copy',
  guide: 'guide',
  specialty: 'specialty',
  leadSource: 'leadSource',
  fields: 'fields',
};

export function parseSettingsSection(raw: string | null, legacyPanel?: string | null): OrderFormSettingsSectionId | null {
  if (raw && (ORDER_FORM_SETTINGS_SECTIONS as readonly string[]).includes(raw)) {
    return raw as OrderFormSettingsSectionId;
  }
  if (legacyPanel && LEGACY_PANEL_TO_SECTION[legacyPanel]) return LEGACY_PANEL_TO_SECTION[legacyPanel];
  return null;
}

export function isSettingsSectionOpenByDefault(id: OrderFormSettingsSectionId): boolean {
  return OPEN_BY_DEFAULT.includes(id);
}
