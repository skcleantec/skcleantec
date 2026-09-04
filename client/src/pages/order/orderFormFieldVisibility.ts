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
