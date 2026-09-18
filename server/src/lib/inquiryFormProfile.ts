/**
 * @see shared/inquiryFormProfile.ts (클라이언트와 동기화)
 */
import {
  isOrderFormSectionToggleKey,
  isOrderFormSectionToggleOn,
  ORDER_FORM_SECTION_OFF_OPTION,
  type OrderFormSectionToggleTemplate,
} from './orderFormSectionToggles.js';

export type InquiryFormRenderMode = 'STANDARD' | 'TEMPLATE';

export type InquiryFormCustomField = {
  fieldKey: string;
  label: string;
  helpText: string | null;
  inputType: string;
  options: string[];
  placeholder: string | null;
  optionStyle: string | null;
  required: boolean;
};

export type InquiryIntakeFormProfile = {
  templateId: string | null;
  title: string;
  icon: string | null;
  isDefault: boolean;
  renderMode: InquiryFormRenderMode;
  systemFieldKeys: string[];
  /** photos / professionalOptions 등 양식에서 끈 섹션 */
  sectionOffKeys: string[];
  customFields: InquiryFormCustomField[];
  canEditCustomAnswers: boolean;
  orderFormId: string | null;
  orderFormSubmitted: boolean;
};

export function inquiryFormHasSystemField(
  profile: (InquiryIntakeFormProfile & OrderFormSectionToggleTemplate) | null | undefined,
  key: string,
): boolean {
  if (isOrderFormSectionToggleKey(key)) {
    if (profile?.sectionOffKeys?.includes(key)) return false;
    return isOrderFormSectionToggleOn(
      {
        isDefault: profile?.isDefault,
        systemFields: [
          ...(profile?.systemFieldKeys ?? []).map((systemField) => ({ systemField })),
          ...(profile?.sectionOffKeys ?? []).map((systemField) => ({
            systemField,
            options: [ORDER_FORM_SECTION_OFF_OPTION],
          })),
        ],
      },
      key,
    );
  }
  if (!profile || profile.isDefault) return true;
  if (profile.renderMode !== 'TEMPLATE') return true;
  return profile.systemFieldKeys.includes(key);
}

export function inquiryFormShowsPropertySection(profile: InquiryIntakeFormProfile | null | undefined): boolean {
  return (
    inquiryFormHasSystemField(profile, 'propertyType') ||
    inquiryFormHasSystemField(profile, 'areaPyeong') ||
    inquiryFormHasSystemField(profile, 'roomCount') ||
    inquiryFormHasSystemField(profile, 'bathroomCount') ||
    inquiryFormHasSystemField(profile, 'balconyCount') ||
    inquiryFormHasSystemField(profile, 'kitchenCount')
  );
}

export function inquiryFormShowsMoveInBlock(profile: InquiryIntakeFormProfile | null | undefined): boolean {
  return inquiryFormHasSystemField(profile, 'moveInDate') || inquiryFormHasSystemField(profile, 'buildingType');
}
