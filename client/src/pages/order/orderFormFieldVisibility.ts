import { isOrderFormPackQuoteFieldKey } from '@shared/orderFormIndustryPacks';
import { normalizeOrderFormYmd } from '@shared/orderFormMoveInTiming';
import { isMarketerLockedOrderFormAddress } from '@shared/orderFormPendingAddress';
import {
  isOrderTimeSlotValue,
  resolvePreferredTimeFromExcelWithLabels,
} from '@shared/orderFormTimeSlotLabels';
import {
  ORDER_FORM_SPACE_COUNT_FIELDS,
  parseOrderFormSpaceCount,
  type OrderFormSpaceCountKey,
} from '@shared/orderFormSpaceCounts';
import type { OrderFormFields, OrderFormLoadedOrder } from './orderFormModel.types';
import {
  DEFAULT_ORDER_FORM_FILL_RULES,
  canCustomerWrite,
  type OrderFormFillRuleKey,
} from '@shared/orderFormFillRules';
import {
  isOrderFormSectionToggleKey,
  isOrderFormSectionToggleOn,
} from '@shared/orderFormSectionToggles';

/** 발급·선입력으로 청소일이 이미 있으면 고객 날짜 단계는 숨긴다. */
export function isOrderFormDateLockedFromOrder(
  order: { preferredDate?: string | null } | null | undefined,
): boolean {
  return Boolean(normalizeOrderFormYmd(order?.preferredDate));
}

/**
 * 시간대는 날짜와 따로 잠근다.
 * 날짜만 있거나 슬롯이 아닌 값(HH:mm 등)이면 고객이 오전·오후를 고를 수 있어야 한다.
 */
export function isOrderFormTimeLockedFromOrder(
  order: { preferredTime?: string | null } | null | undefined,
): boolean {
  const t = order?.preferredTime?.trim();
  return Boolean(t && isOrderTimeSlotValue(t));
}

/** 로드 시 라벨·엑셀 표기를 4슬롯으로 맞추고, 슬롯이 아니면 비운다. */
export function coerceLoadedOrderFormPreferredTime(raw: string | null | undefined): string {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  if (isOrderTimeSlotValue(s)) return s;
  return resolvePreferredTimeFromExcelWithLabels(s) ?? '';
}

export function customerMayEditFillKey(
  order: OrderFormLoadedOrder | null | undefined,
  key: OrderFormFillRuleKey,
): boolean {
  const row = order?.fillRules?.[key];
  if (row) return row.customer !== false;
  return canCustomerWrite(DEFAULT_ORDER_FORM_FILL_RULES[key]);
}

export function fillKeyRequiredForCustomer(
  order: OrderFormLoadedOrder | null | undefined,
  key: OrderFormFillRuleKey,
): boolean {
  const row = order?.fillRules?.[key];
  if (row) return row.required === true;
  return DEFAULT_ORDER_FORM_FILL_RULES[key].required;
}

export function isOrderFormAreaLockedFromOrder(order: {
  areaBasis?: string | null;
  areaPyeong?: number | null;
} | null): boolean {
  if (!order) return false;
  const basis = order.areaBasis?.trim();
  if (basis !== '공급' && basis !== '전용') return false;
  return order.areaPyeong != null && Number.isFinite(order.areaPyeong) && order.areaPyeong > 0;
}

export function isStdFieldOn(
  order: OrderFormLoadedOrder | null | undefined,
  key: string,
): boolean {
  if (isOrderFormPackQuoteFieldKey(key)) return true;
  const tpl = order?.template;
  if (isOrderFormSectionToggleKey(key)) {
    return isOrderFormSectionToggleOn(tpl, key);
  }
  if (!tpl || tpl.isDefault) return true;
  if (tpl.renderMode && tpl.renderMode !== 'TEMPLATE') return true;
  const sys = tpl.systemFields;
  if (!sys || sys.length === 0) return true;
  return sys.some((f) => f.systemField === key);
}

export function isOrderFormPrefillLocked(
  isEditor: boolean,
  prefillMap: Record<string, unknown> | null | undefined,
  key: string,
): boolean {
  if (isEditor || !prefillMap) return false;
  const v = prefillMap[key];
  if (v == null) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'boolean') return v === true;
  if (typeof v === 'number') return Number.isFinite(v);
  return false;
}

export function isCustomerAddressLocked(
  isEditor: boolean,
  prefillMap: Record<string, unknown> | null | undefined,
): boolean {
  return !isEditor && isMarketerLockedOrderFormAddress(prefillMap);
}

/**
 * 방·베란다·화장실·주방 — 1 이상만 선입력 잠금.
 * 0·빈 칸은 고객이 고칠 수 있어야 한다.
 */
export function isOrderFormSpaceCountLocked(
  isEditor: boolean,
  prefillMap: Record<string, unknown> | null | undefined,
  key: OrderFormSpaceCountKey,
): boolean {
  if (isEditor || !prefillMap) return false;
  const n = parseOrderFormSpaceCount(prefillMap[key]);
  return n != null && n > 0;
}

export function shouldShowCustomerRoomsWizardStep(
  order: OrderFormLoadedOrder | null,
  isEditor: boolean,
  skipLocked: boolean,
): boolean {
  if (!isStdFieldOn(order, 'roomCount')) return false;
  if (!skipLocked) return true;
  return ORDER_FORM_SPACE_COUNT_FIELDS.some(
    ({ key }) => !isOrderFormSpaceCountLocked(isEditor, order?.prefillAnswers, key),
  );
}

export function isValidOrderFormEmail(raw: unknown): boolean {
  if (typeof raw !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw.trim().toLowerCase());
}

/** 형식까지 맞는 이메일만 잠금 — 오기재는 고객이 고친다. */
export function isOrderFormEmailFieldLocked(
  isEditor: boolean,
  prefillMap: Record<string, unknown> | null | undefined,
): boolean {
  return (
    isOrderFormPrefillLocked(isEditor, prefillMap, 'customerEmail') &&
    isValidOrderFormEmail(prefillMap?.customerEmail)
  );
}

export function shouldShowCustomerNameWizardStep(
  order: OrderFormLoadedOrder | null,
  isEditor: boolean,
  skipLocked: boolean,
): boolean {
  if (!isStdFieldOn(order, 'customerName')) return false;
  if (!skipLocked) return true;
  if (!isOrderFormPrefillLocked(isEditor, order?.prefillAnswers, 'customerName')) return true;
  const n = order?.prefillAnswers?.customerName;
  return typeof n === 'string' ? n.trim().length === 0 : true;
}

export function shouldShowCustomerEmailWizardStep(
  order: OrderFormLoadedOrder | null,
  isEditor: boolean,
  skipLocked: boolean,
): boolean {
  if (!isStdFieldOn(order, 'customerEmail')) return false;
  if (!skipLocked) return true;
  if (!isOrderFormPrefillLocked(isEditor, order?.prefillAnswers, 'customerEmail')) return true;
  return !isValidOrderFormEmail(order?.prefillAnswers?.customerEmail);
}

export function shouldShowCustomerPropertyWizardStep(
  order: OrderFormLoadedOrder | null,
  isEditor: boolean,
  skipLocked: boolean,
): boolean {
  if (!isStdFieldOn(order, 'propertyType')) return false;
  if (!skipLocked) return true;
  const typeLocked = isOrderFormPrefillLocked(isEditor, order?.prefillAnswers, 'propertyType');
  const oneLocked = isOrderFormPrefillLocked(isEditor, order?.prefillAnswers, 'isOneRoom');
  return !typeLocked || !oneLocked;
}

export function shouldShowCustomerDateWizardStep(
  order: OrderFormLoadedOrder | null,
  isEditor: boolean,
  skipLocked: boolean,
): boolean {
  if (!isStdFieldOn(order, 'preferredDate') && !isStdFieldOn(order, 'preferredTime')) return false;
  if (!skipLocked) return true;
  return isEditor || !Boolean(order?.preferredDate?.trim());
}

export function shouldShowCustomerTimeWizardStep(
  order: OrderFormLoadedOrder | null,
  isEditor: boolean,
  skipLocked: boolean,
): boolean {
  if (!isStdFieldOn(order, 'preferredTime')) return false;
  if (!skipLocked) return true;
  if (isOrderFormPrefillLocked(isEditor, order?.prefillAnswers, 'preferredTime')) {
    return !String(order?.prefillAnswers?.preferredTime ?? '').trim();
  }
  const fromOrder = order?.preferredTime?.trim() ?? '';
  if (fromOrder && isOrderTimeSlotValue(fromOrder)) return false;
  return true;
}

export function shouldShowCustomerTimeDetailWizardStep(
  order: OrderFormLoadedOrder | null,
  form: OrderFormFields,
  skipLocked: boolean,
): boolean {
  if (!isStdFieldOn(order, 'preferredTimeDetail')) return false;
  if (skipLocked && order?.preferredTimeDetail?.trim()) return false;
  const slot = (form.preferredTime.trim() || order?.preferredTime?.trim() || '').trim();
  if (!isOrderTimeSlotValue(slot) || slot === '조율') return false;
  return true;
}

/** 도로명만 잠기고 상세주소가 비어 있으면 고객에게 주소 질문을 보여 준다. */
export function shouldShowCustomerAddressWizardStep(
  order: OrderFormLoadedOrder | null,
  isEditor: boolean,
  skipLocked: boolean,
): boolean {
  if (!isStdFieldOn(order, 'address')) return false;
  if (!skipLocked) return true;
  const streetLocked = isCustomerAddressLocked(isEditor, order?.prefillAnswers);
  const detailLocked = isOrderFormPrefillLocked(isEditor, order?.prefillAnswers, 'addressDetail');
  return !streetLocked || !detailLocked;
}
