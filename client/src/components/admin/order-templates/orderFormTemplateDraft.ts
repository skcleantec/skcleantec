import {
  type OrderFormFieldFillMode,
  type OrderFormFieldInputType,
  type OrderFormFieldOptionLayout,
  type OrderFormFieldOptionStyle,
  type OrderFormSystemFieldDef,
  type OrderFormTemplateField,
  type OrderFormTemplateRenderMode,
} from '../../../api/orderFormTemplates';
import { isOrderFormSectionToggleKey } from '@shared/orderFormSectionToggles';

export type DraftField = Omit<
  OrderFormTemplateField,
  'id' | 'options' | 'placeholder' | 'optionStyle' | 'optionLayout'
> & {
  id?: string;
  options: string[];
  placeholder: string | null;
  optionStyle: OrderFormFieldOptionStyle | null;
  optionLayout: OrderFormFieldOptionLayout | null;
};

export const INPUT_TYPE_OPTIONS: Array<{ value: OrderFormFieldInputType; label: string }> = [
  { value: 'TEXT', label: '한 줄 텍스트' },
  { value: 'TEXTAREA', label: '여러 줄 텍스트' },
  { value: 'NUMBER', label: '숫자' },
  { value: 'MONEY', label: '금액(원)' },
  { value: 'DATE', label: '날짜' },
  { value: 'TIME', label: '시간' },
  { value: 'PHONE', label: '전화번호' },
  { value: 'ADDRESS', label: '주소' },
  { value: 'SELECT', label: '단일 선택' },
  { value: 'MULTISELECT', label: '복수 선택' },
  { value: 'CHECKBOX', label: '체크박스' },
  { value: 'PHOTO', label: '사진 첨부' },
];

export const FILL_MODE_OPTIONS: Array<{ value: OrderFormFieldFillMode; label: string; hint: string }> = [
  { value: 'CUSTOMER', label: '고객 입력', hint: '고객이 발주서에서 직접 입력' },
  { value: 'ADMIN_LOCKED', label: '관리자 고정', hint: '발급 시 관리자가 입력, 고객 수정 불가' },
  { value: 'ADMIN_PREFILL', label: '관리자 선입력', hint: '발급 시 미리 채우되 고객이 수정 가능' },
];

export const OPTION_INPUT_TYPES = new Set<OrderFormFieldInputType>(['SELECT', 'MULTISELECT', 'CHECKBOX']);
export const LIST_PROMOTABLE_INPUT_TYPES = new Set<OrderFormFieldInputType>(['TEXT', 'SELECT', 'NUMBER', 'MULTISELECT']);

export function canPromoteDraftField(d: DraftField): boolean {
  return !d.systemField?.trim() && LIST_PROMOTABLE_INPUT_TYPES.has(d.inputType);
}

export const ICON_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '🧹', label: '빗자루' },
  { value: '🧽', label: '스펀지' },
  { value: '🧼', label: '비누' },
  { value: '🧴', label: '세제' },
  { value: '🪣', label: '양동이' },
  { value: '🧺', label: '바구니' },
  { value: '🚿', label: '샤워' },
  { value: '🛁', label: '욕실' },
  { value: '🚽', label: '화장실' },
  { value: '🪟', label: '창문' },
  { value: '🛋️', label: '소파' },
  { value: '🛏️', label: '침대' },
  { value: '🍳', label: '주방' },
  { value: '🚪', label: '현관' },
  { value: '🏠', label: '집' },
  { value: '🏢', label: '오피스텔' },
  { value: '❄️', label: '에어컨' },
  { value: '🌬️', label: '환기' },
  { value: '🪜', label: '사다리·계단' },
  { value: '✨', label: '광택' },
  { value: '🐜', label: '방역' },
  { value: '💧', label: '물때' },
  { value: '🧤', label: '장갑' },
  { value: '🚗', label: '차량' },
];

export function fieldToDraft(f: OrderFormTemplateField): DraftField {
  const opts = Array.isArray(f.options) ? (f.options as unknown[]).map((o) => String(o)) : [];
  return {
    id: f.id,
    fieldKey: f.fieldKey,
    label: f.label,
    helpText: f.helpText,
    inputType: f.inputType,
    required: f.required,
    sortOrder: f.sortOrder,
    systemField: f.systemField,
    fillMode: f.fillMode,
    showInInquiryList: Boolean(f.showInInquiryList),
    options: opts,
    placeholder: f.placeholder ?? null,
    optionStyle: f.optionStyle ?? null,
    optionLayout: f.optionLayout ?? null,
  };
}

export function draftsToPayload(drafts: DraftField[]): Array<Omit<OrderFormTemplateField, 'id'>> {
  return drafts.map((d, i) => ({
    fieldKey: d.fieldKey?.trim() || `field_${i + 1}`,
    label: d.label,
    helpText: d.helpText && d.helpText.trim() ? d.helpText.trim() : null,
    inputType: d.inputType,
    options: isOrderFormSectionToggleKey(d.systemField)
      ? d.options.map((s) => s.trim()).filter(Boolean)
      : OPTION_INPUT_TYPES.has(d.inputType)
        ? d.options.map((s) => s.trim()).filter(Boolean)
        : [],
    placeholder:
      d.inputType === 'TEXTAREA' || d.inputType === 'TEXT'
        ? d.placeholder && d.placeholder.trim()
          ? d.placeholder.trim()
          : null
        : null,
    optionStyle: d.inputType === 'SELECT' ? d.optionStyle ?? 'DROPDOWN' : null,
    optionLayout:
      OPTION_INPUT_TYPES.has(d.inputType) &&
      (d.inputType !== 'SELECT' || (d.optionStyle ?? 'DROPDOWN') === 'RADIO')
        ? d.optionLayout ?? 'VERTICAL'
        : null,
    required: isLockedRequiredDraft(d) ? true : d.required,
    sortOrder: i,
    systemField: d.systemField && d.systemField.trim() ? d.systemField : null,
    fillMode: d.fillMode,
    showInInquiryList: canPromoteDraftField(d) ? Boolean(d.showInInquiryList) : false,
  }));
}

const ALLOWED_INPUT_TYPES = new Set<OrderFormFieldInputType>(INPUT_TYPE_OPTIONS.map((o) => o.value));

const SYSTEM_FIELD_DEFAULT_OPTIONS: Record<string, string[]> = {
  preferredTime: ['오전', '오후', '사이청소', '조율'],
  propertyType: ['아파트', '오피스텔', '빌라(연립)', '상가', '기타'],
  buildingType: ['신축', '구축', '인테리어', '거주(짐이있는상태)'],
};

export const TEMPLATE_REQUIRED_ORDER = ['customerName', 'customerPhone', 'address', 'preferredDate'];
export const IDENTITY_REQUIRED_KEYS = new Set(TEMPLATE_REQUIRED_ORDER);

export function isLockedRequiredDraft(d: Pick<DraftField, 'systemField' | 'fieldKey'>): boolean {
  return IDENTITY_REQUIRED_KEYS.has(d.systemField ?? '') || IDENTITY_REQUIRED_KEYS.has(d.fieldKey);
}

export function coreFieldToDraft(f: OrderFormSystemFieldDef, sortOrder: number): DraftField {
  const defaultOptions = SYSTEM_FIELD_DEFAULT_OPTIONS[f.key];
  const inputType: OrderFormFieldInputType = defaultOptions
    ? 'SELECT'
    : ALLOWED_INPUT_TYPES.has(f.inputType as OrderFormFieldInputType)
      ? (f.inputType as OrderFormFieldInputType)
      : 'TEXT';
  return {
    fieldKey: f.key,
    label: f.label,
    helpText: null,
    inputType,
    required: IDENTITY_REQUIRED_KEYS.has(f.key),
    sortOrder,
    systemField: f.key,
    fillMode: 'CUSTOMER',
    options: defaultOptions ? [...defaultOptions] : [],
    placeholder: null,
    optionStyle: defaultOptions ? 'DROPDOWN' : null,
    optionLayout: null,
  };
}

export function requiredFieldsForMode(
  systemFields: OrderFormSystemFieldDef[],
  mode: OrderFormTemplateRenderMode,
): OrderFormSystemFieldDef[] {
  const picked = systemFields.filter(
    (f) => (mode === 'TEMPLATE' ? !!f.templateRequired : f.requiredCore) && !f.autoGenerated,
  );
  if (mode !== 'TEMPLATE') return picked;
  const orderIdx = (key: string) => {
    const i = TEMPLATE_REQUIRED_ORDER.indexOf(key);
    return i === -1 ? TEMPLATE_REQUIRED_ORDER.length : i;
  };
  return [...picked].sort((a, b) => orderIdx(a.key) - orderIdx(b.key));
}

export function buildDefaultCoreDrafts(
  systemFields: OrderFormSystemFieldDef[],
  mode: OrderFormTemplateRenderMode = 'STANDARD',
): DraftField[] {
  return requiredFieldsForMode(systemFields, mode).map((f, i) => coreFieldToDraft(f, i));
}
