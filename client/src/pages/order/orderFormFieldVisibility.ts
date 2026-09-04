import { isMarketerLockedOrderFormAddress } from '@shared/orderFormPendingAddress';
import type { OrderFormLoadedOrder } from './orderFormModel.types';

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
  const tpl = order?.template;
  if (!tpl || tpl.isDefault) return true;
  const sys = tpl.systemFields;
  if (!sys) return true;
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
