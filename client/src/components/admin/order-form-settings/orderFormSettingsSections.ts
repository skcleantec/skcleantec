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
