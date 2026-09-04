import {
  isCustomerAddressLocked,
  isOrderFormAreaLockedFromOrder,
  isOrderFormPrefillLocked,
  isStdFieldOn,
  shouldShowCustomerAddressWizardStep,
  shouldShowCustomerDateWizardStep,
  shouldShowCustomerEmailWizardStep,
  shouldShowCustomerNameWizardStep,
  shouldShowCustomerPropertyWizardStep,
  shouldShowCustomerRoomsWizardStep,
  shouldShowCustomerTimeDetailWizardStep,
  shouldShowCustomerTimeWizardStep,
} from '../../../pages/order/orderFormFieldVisibility';
import type { OrderFormFields, OrderFormLoadedOrder } from '../../../pages/order/orderFormModel.types';
import type { OrderFormPublicTemplateField } from '../../../api/orderform';

export type OrderFormCustomerStepId =
  | 'welcome'
  | 'name'
  | 'address'
  | 'phones'
  | 'email'
  | 'property'
  | 'area'
  | 'date'
  | 'time'
  | 'timeDetail'
  | 'rooms'
  | 'building'
  | 'moveIn'
  | 'notes'
  | `custom:${string}`
  | 'photos'
  | 'professional'
  | 'review'
  | 'guide';

export type OrderFormCustomerStepKind = 'choice' | 'input' | 'review' | 'guide' | 'welcome';

export type OrderFormCustomerStep = {
  id: OrderFormCustomerStepId;
  kind: OrderFormCustomerStepKind;
  title: string;
  hint?: string;
  skippable?: boolean;
  customField?: OrderFormPublicTemplateField;
};

export function resolveOrderFormCustomerSteps(args: {
  order: OrderFormLoadedOrder | null;
  form: OrderFormFields;
  customFields: OrderFormPublicTemplateField[];
  isEditor: boolean;
  skipLocked: boolean;
}): OrderFormCustomerStep[] {
  const { order, form, customFields, isEditor, skipLocked } = args;
  const std = (key: string) => isStdFieldOn(order, key);
  const locked = (key: string) =>
    skipLocked && isOrderFormPrefillLocked(isEditor, order?.prefillAnswers, key);
  const areaLocked = skipLocked && !isEditor && isOrderFormAreaLockedFromOrder(order);
  const addressLocked = skipLocked && isCustomerAddressLocked(isEditor, order?.prefillAnswers);

  const steps: OrderFormCustomerStep[] = [
    {
      id: 'welcome',
      kind: 'welcome',
      title: '청소 일정을 알려 주세요',
      hint: '질문 하나씩 답하시면 됩니다. 이어서 작성한 내용은 이 기기에서 잠시 보관됩니다.',
    },
  ];

  if (shouldShowCustomerNameWizardStep(order, isEditor, skipLocked)) {
    steps.push({
      id: 'name',
      kind: 'input',
      title: '고객 성함이 어떻게 되세요?',
      hint: '예약 확인에 쓰이는 이름입니다.',
    });
  }
  if (shouldShowCustomerAddressWizardStep(order, isEditor, skipLocked)) {
    const detailOnly = addressLocked && !locked('addressDetail');
    steps.push({
      id: 'address',
      kind: 'input',
      title: detailOnly ? '상세주소를 알려 주세요' : '청소할 주소는 어디인가요?',
      hint: detailOnly
        ? '동·호수, 층, 상호 등을 적어 주세요. 도로명 주소는 상담에서 이미 정해졌습니다.'
        : '「주소 검색」으로 선택한 뒤 상세주소를 적어 주세요.',
    });
  }
  if ((std('customerPhone') && !locked('customerPhone')) || !locked('customerPhone2')) {
    steps.push({
      id: 'phones',
      kind: 'input',
      title: '연락처를 알려 주세요',
      hint: '보조 연락처는 필수입니다. 전일 연락이 안 되면 서비스가 취소될 수 있으니 정확하게 적어 주세요.',
    });
  }
  if (shouldShowCustomerEmailWizardStep(order, isEditor, skipLocked)) {
    steps.push({
      id: 'email',
      kind: 'input',
      title: '이메일이 있으신가요?',
      hint: '제출 확인 메일을 받을 수 있습니다.',
    });
  }
  if (shouldShowCustomerPropertyWizardStep(order, isEditor, skipLocked)) {
    steps.push({
      id: 'property',
      kind: 'choice',
      title: '어떤 공간인가요?',
    });
  }
  if ((std('areaPyeong') || isOrderFormAreaLockedFromOrder(order)) && !areaLocked) {
    steps.push({
      id: 'area',
      kind: 'input',
      title: '공급면적은 얼마인가요?',
      hint: '반드시 평수로 적어 주세요. 제곱미터만 알고 계시면 평으로 환산합니다.',
    });
  }
  if (shouldShowCustomerDateWizardStep(order, isEditor, skipLocked)) {
    steps.push({
      id: 'date',
      kind: 'input',
      title: '희망 청소일은 언제인가요?',
      hint: '날짜를 정확히 확인해 주세요. 잘못 적으면 위약금이 생길 수 있습니다.',
    });
  }
  if (shouldShowCustomerTimeWizardStep(order, isEditor, skipLocked)) {
    steps.push({
      id: 'time',
      kind: 'choice',
      title: '오전·오후 중 언제가 좋으세요?',
    });
  }
  if (shouldShowCustomerTimeDetailWizardStep(order, form, skipLocked)) {
    steps.push({
      id: 'timeDetail',
      kind: 'choice',
      title: '구체적인 시각을 골라 주세요',
    });
  }
  if (shouldShowCustomerRoomsWizardStep(order, isEditor, skipLocked)) {
    steps.push({
      id: 'rooms',
      kind: 'input',
      title: '방·화장실·베란다·주방은 어떻게 되나요?',
      hint: '없는 공간은 0으로 적어 주세요. 0이거나 비어 있는 칸은 직접 고칠 수 있습니다.',
    });
  }
  if (std('buildingType') && !locked('buildingType')) {
    steps.push({
      id: 'building',
      kind: 'choice',
      title: '건물 형태는요?',
    });
  }
  if (
    std('moveInDate') &&
    (!locked('moveInTiming') || !locked('moveInDate') || !locked('moveInDateUndecided'))
  ) {
    steps.push({
      id: 'moveIn',
      kind: 'input',
      title: '입주 시기는요?',
    });
  }
  if (std('specialNotes') && !locked('specialNotes')) {
    steps.push({
      id: 'notes',
      kind: 'input',
      title: '추가로 알려 주실 게 있나요?',
      hint: '전화 상담 내용, 층수·주택 형태 등을 적어 주세요.',
      skippable: true,
    });
  }
  for (const cf of customFields) {
    if (skipLocked && isOrderFormPrefillLocked(isEditor, order?.prefillAnswers, cf.fieldKey)) continue;
    const choice =
      cf.inputType === 'SELECT' || cf.inputType === 'MULTISELECT' || cf.inputType === 'CHECKBOX';
    steps.push({
      id: `custom:${cf.fieldKey}`,
      kind: choice ? 'choice' : 'input',
      title: cf.label,
      hint: cf.helpText?.trim() || undefined,
      skippable: !cf.required,
      customField: cf,
    });
  }
  if (std('photos')) {
    steps.push({
      id: 'photos',
      kind: 'input',
      title: '현장 사진을 올려 주세요',
      hint: '없어도 제출할 수 있습니다.',
      skippable: true,
    });
  }
  if (std('professionalOptions') && !locked('professionalOptionIds')) {
    steps.push({
      id: 'professional',
      kind: 'input',
      title: '추가로 필요한 작업이 있나요?',
      hint: '없으면 다음으로 넘어가 주세요.',
      skippable: true,
    });
  }
  steps.push({
    id: 'review',
    kind: 'review',
    title: '이렇게 접수할까요?',
    hint: '틀린 항목은 눌러서 고칠 수 있습니다.',
  });
  steps.push({
    id: 'guide',
    kind: 'guide',
    title: '안내사항을 확인해 주세요',
    hint: '안내사항을 읽어주셔야 제출하기가 완료됩니다.',
  });
  return steps;
}

/** 제출 검증 fieldId → 고객 위저드 질문 */
export function wizardStepIdForSubmitField(fieldId?: string): OrderFormCustomerStepId | null {
  if (!fieldId) return null;
  if (fieldId.startsWith('order-field-custom-')) {
    return `custom:${fieldId.slice('order-field-custom-'.length)}`;
  }
  if (fieldId.includes('customerName')) return 'name';
  if (fieldId.includes('address')) return 'address';
  if (fieldId.includes('customerPhone') || fieldId.includes('Phone2')) return 'phones';
  if (fieldId.includes('customerEmail')) return 'email';
  if (fieldId.includes('propertyType')) return 'property';
  if (fieldId.includes('area')) return 'area';
  if (fieldId.includes('preferredTimeDetail')) return 'timeDetail';
  if (fieldId.includes('preferredTime')) return 'time';
  if (fieldId.includes('schedule') || fieldId.includes('preferredDate')) return 'date';
  if (
    fieldId.includes('roomCount') ||
    fieldId.includes('balconyCount') ||
    fieldId.includes('bathroomCount') ||
    fieldId.includes('kitchenCount')
  ) {
    return 'rooms';
  }
  if (fieldId.includes('building')) return 'building';
  if (fieldId.includes('moveIn')) return 'moveIn';
  if (fieldId.includes('agree')) return 'guide';
  return null;
}

export function isOrderFormCustomerStepId(value: string | null | undefined): value is OrderFormCustomerStepId {
  if (!value) return false;
  if (value.startsWith('custom:')) return true;
  return (
    value === 'welcome' ||
    value === 'name' ||
    value === 'address' ||
    value === 'phones' ||
    value === 'email' ||
    value === 'property' ||
    value === 'area' ||
    value === 'date' ||
    value === 'time' ||
    value === 'timeDetail' ||
    value === 'rooms' ||
    value === 'building' ||
    value === 'moveIn' ||
    value === 'notes' ||
    value === 'photos' ||
    value === 'professional' ||
    value === 'review' ||
    value === 'guide'
  );
}
