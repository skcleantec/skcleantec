/**
 * 접수 화면이 발주서 양식을 따를 때 쓰는 가시성 규칙.
 * 고객 공개 폼 `templateHasSystemField` / `isStdFieldOn` 과 동일해야 한다.
 */
import {
  isOrderFormSectionToggleKey,
  isOrderFormSectionToggleOn,
  ORDER_FORM_SECTION_OFF_OPTION,
  type OrderFormSectionToggleTemplate,
} from './orderFormSectionToggles';

export type InquiryFormRenderMode = 'STANDARD' | 'TEMPLATE';

export type InquiryFormCustomField = {
  fieldKey: string;
  label: string;
  helpText: string | null;
  inputType: string;
  options: string[];
  placeholder: string | null;
  optionStyle: string | null;
  optionLayout: string | null;
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
  /** 발주서가 있을 때만 커스텀 답을 저장할 수 있다 (고객 발송·제출과 같은 OrderForm) */
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
  if (!profile) return true;
  if (profile.systemFieldKeys.length > 0) return profile.systemFieldKeys.includes(key);
  return true;
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
