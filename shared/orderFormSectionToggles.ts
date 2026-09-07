/** 발주서 양식 — 고객에게 보일 표준 섹션(사진·전문시공) 켜기/끄기 */

export const ORDER_FORM_PHOTOS_SECTION_KEY = 'photos';
export const ORDER_FORM_PROFESSIONAL_SECTION_KEY = 'professionalOptions';

export const ORDER_FORM_SECTION_TOGGLE_KEYS = [
  ORDER_FORM_PHOTOS_SECTION_KEY,
  ORDER_FORM_PROFESSIONAL_SECTION_KEY,
] as const;

export type OrderFormSectionToggleKey = (typeof ORDER_FORM_SECTION_TOGGLE_KEYS)[number];

/** 템플릿 필드 options에 넣으면 해당 섹션을 끈다. 기본 양식은 필드가 없으면 레거시처럼 켠다. */
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

/**
 * 섹션 표시 여부.
 * - 필드 없음 + 기본/레거시 양식 → 켜짐(예전과 같음)
 * - 필드 없음 + 내가 만든 양식 → 꺼짐
 * - 필드 있고 off 표시 → 꺼짐
 * - 필드 있고 off 아님 → 켜짐
 */
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
