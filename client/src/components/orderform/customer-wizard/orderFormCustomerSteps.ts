import { isPreferredTimeDetailRequired } from '../../../constants/orderFormSchedule';
import { DEFAULT_ORDER_TIME_SLOT_QUESTION } from '@shared/orderFormTimeSlotLabels';
import { ORDER_FORM_SPACE_COUNT_FIELDS } from '@shared/orderFormSpaceCounts';
import {
  isCustomerAddressLocked,
  isOrderFormAreaLockedFromOrder,
  isOrderFormPrefillLocked,
  isOrderFormSpaceCountLocked,
  isStdFieldOn,
  shouldShowCustomerAddressWizardStep,
  shouldShowCustomerDateWizardStep,
  shouldShowCustomerEmailWizardStep,
  shouldShowCustomerNameWizardStep,
  shouldShowCustomerPropertyWizardStep,
  shouldShowCustomerRoomsWizardStep,
  shouldShowCustomerTimeDetailWizardStep,
  shouldShowCustomerTimeWizardStep,
  customerMayEditFillKey,
} from '../../../pages/order/orderFormFieldVisibility';
import type { OrderFormFields, OrderFormLoadedOrder } from '../../../pages/order/orderFormModel.types';
import type { OrderFormPublicTemplateField } from '../../../api/orderform';
import { shouldCollectOrderFormCleaningKind } from '@shared/orderFormCleaningKind';
import {
  customerPageById,
  resolveCustomerPages,
  type CustomerPageChoice,
  type CustomerPageLine,
} from '@shared/orderFormCustomerPages';

function systemFieldHelp(order: OrderFormLoadedOrder | null, key: string): string | undefined {
  const text = order?.template?.systemFields?.find((field) => field.systemField === key)?.helpText?.trim();
  return text || undefined;
}

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
  choices?: CustomerPageChoice[];
  lines?: CustomerPageLine[];
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
  const prefilled = (key: string) => isOrderFormPrefillLocked(isEditor, order?.prefillAnswers, key);
  const areaLocked = skipLocked && !isEditor && isOrderFormAreaLockedFromOrder(order);
  const streetLocked = isCustomerAddressLocked(isEditor, order?.prefillAnswers);

  const pages = resolveCustomerPages(order?.template?.customerPages ?? null);
  const copy = (id: string) => customerPageById(pages, id);
  const shown = (id: string) => copy(id)?.enabled !== false;
  const steps: OrderFormCustomerStep[] = [];
  if (shouldCollectOrderFormCleaningKind(order?.template) && !locked('cleaningKind') && shown('welcome')) {
    const page = copy('welcome');
    steps.push({
      id: 'welcome',
      kind: 'welcome',
      title: page?.title || '어떤 청소를 원하세요?',
      hint: page?.hint,
      choices: page?.choices,
      lines: page?.lines,
    });
  }

  if (customerMayEditFillKey(order, 'customerName') && shouldShowCustomerNameWizardStep(order, isEditor, skipLocked) && shown('name')) {
    const nameLocked = prefilled('customerName');
    const page = copy('name');
    steps.push({
      id: 'name',
      kind: 'input',
      title: nameLocked ? page?.titleLocked || '성함이 이렇게 맞나요?' : page?.title || '고객 성함이 어떻게 되세요?',
      hint: nameLocked ? page?.hintLocked : page?.hint,
      lines: page?.lines,
    });
  }
  if (customerMayEditFillKey(order, 'address') && shouldShowCustomerAddressWizardStep(order, isEditor, skipLocked) && shown('address')) {
    const detailOnly = streetLocked && !prefilled('addressDetail');
    const addressAllSet = streetLocked && prefilled('addressDetail');
    const page = copy('address');
    steps.push({
      id: 'address',
      kind: 'input',
      title: addressAllSet
        ? page?.titleAllSet || '주소가 이렇게 맞나요?'
        : detailOnly
          ? page?.titleDetailOnly || '상세주소를 알려 주세요'
          : page?.title || '청소할 주소는 어디인가요?',
      hint: addressAllSet ? page?.hintAllSet : detailOnly ? page?.hintDetailOnly : page?.hint,
      lines: page?.lines,
    });
  }
  if (
    (customerMayEditFillKey(order, 'customerPhone') && std('customerPhone') && !locked('customerPhone')) ||
    (customerMayEditFillKey(order, 'customerPhone2') && !locked('customerPhone2'))
  ) {
    if (shown('phones')) steps.push({
      id: 'phones',
      kind: 'input',
      title: copy('phones')?.title || '연락처를 알려 주세요',
      hint: copy('phones')?.hint,
      lines: copy('phones')?.lines,
    });
  }
  if (customerMayEditFillKey(order, 'customerEmail') && shouldShowCustomerEmailWizardStep(order, isEditor, skipLocked) && shown('email')) {
    steps.push({
      id: 'email',
      kind: 'input',
      title: copy('email')?.title || '이메일이 있으신가요?',
      hint: copy('email')?.hint,
    });
  }
  if (customerMayEditFillKey(order, 'propertyType') && shouldShowCustomerPropertyWizardStep(order, isEditor, skipLocked) && shown('property')) {
    steps.push({
      id: 'property',
      kind: 'choice',
      title: copy('property')?.title || '어떤 공간인가요?',
      hint: copy('property')?.hint,
      choices: copy('property')?.choices,
    });
  }
  if (
    customerMayEditFillKey(order, 'areaPyeong') &&
    (std('areaPyeong') || isOrderFormAreaLockedFromOrder(order)) &&
    !areaLocked
  ) {
    if (shown('area')) steps.push({
      id: 'area',
      kind: 'input',
      title: copy('area')?.title || '공급면적은 얼마인가요?',
      hint: copy('area')?.hint,
    });
  }
  if (customerMayEditFillKey(order, 'preferredDate') && shouldShowCustomerDateWizardStep(order, isEditor, skipLocked) && shown('date')) {
    const dateLocked = prefilled('preferredDate') || Boolean(order?.preferredDate?.trim());
    const page = copy('date');
    steps.push({
      id: 'date',
      kind: 'input',
      title: dateLocked ? page?.titleLocked || '희망 청소일이 이렇게 맞나요?' : page?.title || '희망 청소일은 언제인가요?',
      hint: dateLocked ? page?.hintLocked : page?.hint,
    });
  }
  if (customerMayEditFillKey(order, 'preferredTime') && shouldShowCustomerTimeWizardStep(order, isEditor, skipLocked) && shown('time')) {
    const timeLocked = prefilled('preferredTime') || Boolean(order?.preferredTime?.trim());
    const page = copy('time');
    steps.push({
      id: 'time',
      kind: 'choice',
      title: timeLocked
        ? page?.titleLocked || '시간대가 이렇게 맞나요?'
        : page?.title || order?.formConfig?.timeSlotQuestionTitle?.trim() || DEFAULT_ORDER_TIME_SLOT_QUESTION,
      hint: [page?.hint || systemFieldHelp(order, 'preferredTime'), timeLocked ? page?.hintLocked : undefined]
        .filter(Boolean)
        .join(' ') || undefined,
    });
  }
  if (
    customerMayEditFillKey(order, 'preferredTimeDetail') &&
    shouldShowCustomerTimeDetailWizardStep(order, form, skipLocked)
  ) {
    if (shown('timeDetail')) steps.push({
      id: 'timeDetail',
      kind: 'choice',
      title: copy('timeDetail')?.title || '구체적인 시각을 골라 주세요',
      hint: copy('timeDetail')?.hint || systemFieldHelp(order, 'preferredTimeDetail'),
      skippable: !isPreferredTimeDetailRequired(form.preferredTime),
    });
  }
  if (customerMayEditFillKey(order, 'roomCount') && shouldShowCustomerRoomsWizardStep(order, isEditor, skipLocked)) {
    const roomsAllLocked = ORDER_FORM_SPACE_COUNT_FIELDS.every(({ key }) =>
      isOrderFormSpaceCountLocked(isEditor, order?.prefillAnswers, key),
    );
    const roomsAnyLocked = ORDER_FORM_SPACE_COUNT_FIELDS.some(({ key }) =>
      isOrderFormSpaceCountLocked(isEditor, order?.prefillAnswers, key),
    );
    if (shown('rooms')) {
    const page = copy('rooms');
    steps.push({
      id: 'rooms',
      kind: 'input',
      title: roomsAllLocked
        ? page?.titleAllSet || '방·화장실·베란다·주방은 이렇게 맞나요?'
        : page?.title || '방·화장실·베란다·주방은 어떻게 되나요?',
      hint: roomsAllLocked
        ? page?.hintAllSet
        : roomsAnyLocked
          ? page?.hintPartial
          : page?.hint,
    });
    }
  }
  if (customerMayEditFillKey(order, 'buildingType') && std('buildingType') && !locked('buildingType') && shown('building')) {
    steps.push({
      id: 'building',
      kind: 'choice',
      title: copy('building')?.title || '건물 형태는요?',
      hint: copy('building')?.hint,
      choices: copy('building')?.choices,
    });
  }
  if (
    customerMayEditFillKey(order, 'moveInDate') &&
    std('moveInDate') &&
    (!locked('moveInTiming') || !locked('moveInDate') || !locked('moveInDateUndecided'))
  ) {
    if (shown('moveIn')) steps.push({
      id: 'moveIn',
      kind: 'input',
      title: copy('moveIn')?.title || '입주 시기는요?',
      hint: copy('moveIn')?.hint,
    });
  }
  if (customerMayEditFillKey(order, 'specialNotes') && std('specialNotes') && !locked('specialNotes') && shown('notes')) {
    steps.push({
      id: 'notes',
      kind: 'input',
      title: copy('notes')?.title || '추가로 알려 주실 게 있나요?',
      hint: copy('notes')?.hint,
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
  if (customerMayEditFillKey(order, 'photos') && std('photos') && shown('photos')) {
    steps.push({
      id: 'photos',
      kind: 'input',
      title: copy('photos')?.title || '현장 사진을 올려 주세요',
      hint: copy('photos')?.hint,
      skippable: true,
    });
  }
  if (
    customerMayEditFillKey(order, 'professionalOptions') &&
    std('professionalOptions') &&
    !locked('professionalOptionIds')
  ) {
    if (shown('professional')) steps.push({
      id: 'professional',
      kind: 'input',
      title: copy('professional')?.title || '추가로 필요한 작업이 있나요?',
      hint: copy('professional')?.hint,
      skippable: true,
    });
  }
  for (const page of pages) {
    if (!page.id.startsWith('extra_') || !page.enabled) continue;
    steps.push({
      id: `custom:${page.id}`,
      kind: page.choices.length ? 'choice' : 'input',
      title: page.title,
      hint: page.hint || undefined,
      skippable: true,
      choices: page.choices,
      customField: {
        fieldKey: page.id,
        label: page.title,
        helpText: page.hint || null,
        inputType: page.choices.length ? 'SELECT' : 'TEXT',
        options: page.choices.map((choice) => choice.label),
        placeholder: null,
        optionStyle: 'RADIO',
        optionLayout: 'VERTICAL',
        required: false,
        fillMode: 'CUSTOMER',
      },
    });
  }
  steps.push({
    id: 'review',
    kind: 'review',
    title: copy('review')?.title || '이렇게 접수할까요?',
    hint: copy('review')?.hint,
  });
  steps.push({
    id: 'guide',
    kind: 'guide',
    title: copy('guide')?.title || '안내사항을 확인해 주세요',
    hint: copy('guide')?.hint,
  });
  return steps;
}

/** 제출 검증 fieldId → 고객 위저드 질문 */
export function wizardStepIdForSubmitField(fieldId?: string): OrderFormCustomerStepId | null {
  if (!fieldId) return null;
  if (fieldId.startsWith('order-field-custom-')) {
    return `custom:${fieldId.slice('order-field-custom-'.length)}`;
  }
  if (fieldId.includes('cleaningKind')) return 'welcome';
  if (fieldId.includes('customerName')) return 'name';
  if (fieldId.includes('address')) return 'address';
  if (fieldId.includes('customerPhone') || fieldId.includes('Phone2')) return 'phones';
  if (fieldId.includes('customerEmail')) return 'email';
  if (fieldId.includes('propertyType')) return 'property';
  if (fieldId.includes('area')) return 'area';
  if (fieldId.includes('preferredTimeDetail')) return 'timeDetail';
  if (fieldId.includes('preferredTime')) return 'time';
  if (fieldId.includes('schedule')) return 'time';
  if (fieldId.includes('preferredDate')) return 'date';
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
