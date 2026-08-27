import {
  ALL_DAY_PREFERRED_TIME_VALUE,
  isAllDayPreferredTime,
} from '@shared/scheduleAllDayTime';
import {
  buildOrderTimeSlotOptions,
  type OrderTimeSlotLabels,
} from '@shared/orderFormTimeSlotLabels';

const ALL_DAY_SELECT_OPTION = {
  value: ALL_DAY_PREFERRED_TIME_VALUE,
  label: '종일 (하루 한 건 · 오전·오후 슬롯 모두 사용)',
} as const;

export function canStaffSetAllDayPreferredTime(role: string | null | undefined): boolean {
  return role === 'ADMIN' || role === 'MARKETER';
}

export function buildStaffInquiryTimeSlotSelectOptions(
  labels: OrderTimeSlotLabels | null | undefined,
  role: string | null | undefined,
) {
  const base = buildOrderTimeSlotOptions(labels);
  if (!canStaffSetAllDayPreferredTime(role)) return base;
  return [...base, ALL_DAY_SELECT_OPTION];
}

export { ALL_DAY_PREFERRED_TIME_VALUE, isAllDayPreferredTime };
