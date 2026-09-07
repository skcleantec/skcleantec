/**
 * @see shared/orderFormSectionToggles.ts (클라이언트와 동기화)
 * 발주서 양식 — 고객에게 보일 표준 섹션(사진·전문시공) 켜기/끄기
 */

export const ORDER_FORM_PHOTOS_SECTION_KEY = 'photos';
export const ORDER_FORM_PROFESSIONAL_SECTION_KEY = 'professionalOptions';

export const ORDER_FORM_SECTION_TOGGLE_KEYS = [
  ORDER_FORM_PHOTOS_SECTION_KEY,
  ORDER_FORM_PROFESSIONAL_SECTION_KEY,
] as const;

export type OrderFormSectionToggleKey = (typeof ORDER_FORM_SECTION_TOGGLE_KEYS)[number];

export const ORDER_FORM_SECTION_OFF_OPTION = '__section_off__';

export function isOrderFormSectionToggleKey(key: string | null | undefined): key is OrderFormSectionToggleKey {
  return !!key && (ORDER_FORM_SECTION_TOGGLE_KEYS as readonly string[]).includes(key);
}

export function isOrderFormSectionOffOptions(options: unknown): boolean {
  if (!Array.isArray(options)) return false;
  return options.map((o) => String(o)).includes(ORDER_FORM_SECTION_OFF_OPTION);
}

export type OrderFormSectionToggleTemplate = {
  isDefault?: boolean | null;
  systemFields?: Array<{ systemField: string; options?: string[] | null }> | null;
};

export function isOrderFormSectionToggleOn(
  template: OrderFormSectionToggleTemplate | null | undefined,
  key: string,
): boolean {
  if (!isOrderFormSectionToggleKey(key)) return true;
  const field = template?.systemFields?.find((f) => f.systemField === key);
  if (!field) {
    return Boolean(!template || template.isDefault);
  }
  return !isOrderFormSectionOffOptions(field.options);
}

export function optionsForOrderFormSectionToggle(on: boolean): string[] {
  return on ? [] : [ORDER_FORM_SECTION_OFF_OPTION];
}
