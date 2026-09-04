import { isPreferredTimeDetailRequired } from '../../../constants/orderFormSchedule';
import { isOrderTimeSlotValue } from '@shared/orderFormTimeSlotLabels';
import { allowedPreferredTimeDetailValues } from '../../../constants/orderFormPreferredTimeDetail';
import { validateOrderFormSpaceCounts } from '@shared/orderFormSpaceCounts';
import {
  parseMoveInTiming,
  validateMoveInTimingFields,
} from '@shared/orderFormMoveInTiming';
import { kstTodayYmd } from '../../../utils/dateFormat';
import { isRealCustomerAddress } from '@shared/orderFormPendingAddress';
import { hasOrderFormBuildingTypeChoice } from '../../../utils/orderFormOneRoom';
import { isAcUnitsAnswerEmpty, ORDER_FORM_AC_UNITS_FIELD_KEY } from '@shared/orderFormAcUnits';
import {
  isCustomerAddressLocked,
  isOrderFormPrefillLocked,
  isStdFieldOn,
} from '../../../pages/order/orderFormFieldVisibility';
import type { OrderFormFields, OrderFormLoadedOrder } from '../../../pages/order/orderFormModel.types';
import type { OrderFormCustomerStep } from './orderFormCustomerSteps';

export function validateCustomerStep(args: {
  step: OrderFormCustomerStep;
  form: OrderFormFields;
  customAnswers: Record<string, unknown>;
  order: OrderFormLoadedOrder | null;
  isEditor: boolean;
  addressConfirmedViaSearch: boolean;
  oneRoomLabel: string;
  guideTermsAt: string | null;
}): string | null {
  const {
    step,
    form,
    customAnswers,
    order,
    isEditor,
    addressConfirmedViaSearch,
    oneRoomLabel,
    guideTermsAt,
  } = args;
  const prefill = order?.prefillAnswers ?? null;
  const prefillLocked = (key: string) => isOrderFormPrefillLocked(isEditor, prefill, key);

  switch (step.id) {
    case 'welcome':
      return null;
    case 'name':
      return form.customerName.trim() ? null : '성함을 입력해주세요.';
    case 'address': {
      if (!isRealCustomerAddress(form.address)) {
        return '「주소 검색」 버튼으로 주소를 선택해 주세요.';
      }
      const addressLockedByPrefill =
        isCustomerAddressLocked(isEditor, prefill) && isRealCustomerAddress(form.address);
      const viaSearch = addressLockedByPrefill || addressConfirmedViaSearch;
      if (!isEditor && !viaSearch && isRealCustomerAddress(form.address)) {
        return '「주소 검색」 버튼으로 주소를 선택해 주세요.';
      }
      if (!prefillLocked('addressDetail') && !form.addressDetail.trim()) {
        return '상세주소를 입력해 주세요.';
      }
      return null;
    }
    case 'phones': {
      if (isStdFieldOn(order, 'customerPhone') && !form.customerPhone.trim()) {
        return '대표 전화번호를 입력해주세요.';
      }
      if (isStdFieldOn(order, 'customerPhone2') && !form.customerPhoneSecondary.trim()) {
        return '보조 전화번호를 입력해주세요.';
      }
      return null;
    }
    case 'email': {
      const emailTrim = form.customerEmail.trim().toLowerCase();
      if (!emailTrim) return '이메일을 입력해 주세요.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrim)) return '이메일 형식이 올바르지 않습니다.';
      return null;
    }
    case 'property':
      return hasOrderFormBuildingTypeChoice(form.propertyType, form.isOneRoom)
        ? null
        : `건축물 유형 또는 ${oneRoomLabel}을 선택해주세요.`;
    case 'area': {
      if (!form.areaBasis || (form.areaBasis !== '공급' && form.areaBasis !== '전용')) {
        return '면적 기준으로 공급면적 또는 전용면적을 선택해주세요.';
      }
      const area = parseFloat(form.areaPyeong.replace(/,/g, '').trim());
      if (Number.isNaN(area) || area <= 0) {
        return form.areaBasis === '공급'
          ? '공급면적(분양평수)을 평 단위로 입력해 주세요.'
          : '전용면적(실제 내 집 공간)을 평 단위로 입력해 주세요.';
      }
      return null;
    }
    case 'date': {
      const date = form.preferredDate.trim();
      if (!date) return '청소날짜(서비스받으실 날짜)를 확인해 주세요.';
      if (date < kstTodayYmd()) return '청소일은 오늘(한국 기준)부터 선택할 수 있습니다.';
      return null;
    }
    case 'time':
      return isOrderTimeSlotValue(form.preferredTime) ? null : '시간대를 선택해주세요.';
    case 'timeDetail': {
      if (isPreferredTimeDetailRequired(form.preferredTime) && !form.preferredTimeDetail.trim()) {
        return '사이청소 선택 시 구체적 시각을 선택해 주세요.';
      }
      if (
        form.preferredTimeDetail.trim() &&
        isOrderTimeSlotValue(form.preferredTime) &&
        form.preferredTime !== '조율' &&
        !allowedPreferredTimeDetailValues(form.preferredTime).has(form.preferredTimeDetail.trim())
      ) {
        return '구체적 시각을 해당 시간대 범위에서 선택해 주세요.';
      }
      return null;
    }
    case 'rooms':
      return (
        validateOrderFormSpaceCounts({
          roomCount: form.roomCount,
          balconyCount: form.balconyCount,
          bathroomCount: form.bathroomCount,
          kitchenCount: form.kitchenCount,
        }) ?? null
      );
    case 'building':
      return form.buildingType
        ? null
        : '신축·구축·인테리어·거주(짐이있는상태) 중 하나를 선택해주세요.';
    case 'moveIn': {
      const moveInErr = validateMoveInTimingFields(
        {
          moveInTiming: parseMoveInTiming(form.moveInTiming),
          moveInDate: form.moveInDate,
          moveInDateUndecided: form.moveInDateUndecided,
        },
        { requireTiming: true },
      );
      if (moveInErr) return moveInErr;
      const moveInMinYmd = kstTodayYmd();
      if (
        !form.moveInDateUndecided &&
        form.moveInDate.trim() &&
        form.moveInDate.trim() < moveInMinYmd
      ) {
        return '이사 예정일은 오늘(한국 기준) 이후 날짜만 선택할 수 있습니다.';
      }
      return null;
    }
    case 'notes':
    case 'photos':
    case 'professional':
    case 'review':
      return null;
    case 'guide':
      return guideTermsAt ? null : '[필수] 예약 안내 및 개인정보 제3자 제공 동의가 필요합니다.';
    default: {
      if (typeof step.id === 'string' && step.id.startsWith('custom:') && step.customField) {
        const cf = step.customField;
        if (!cf.required) return null;
        const v = customAnswers[cf.fieldKey];
        if (cf.fieldKey === ORDER_FORM_AC_UNITS_FIELD_KEY) {
          return isAcUnitsAnswerEmpty(v) ? `「${cf.label}」 항목을 입력해 주세요.` : null;
        }
        const empty =
          v == null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && v.length === 0);
        return empty ? `「${cf.label}」 항목을 입력해 주세요.` : null;
      }
      return null;
    }
  }
}
