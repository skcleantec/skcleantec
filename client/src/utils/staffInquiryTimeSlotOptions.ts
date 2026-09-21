import {
  ALL_DAY_PREFERRED_TIME_VALUE,
  isAllDayPreferredTime,
} from '@shared/scheduleAllDayTime';
import {
  buildTimeSlotOptionsForForm,
  type OrderTimeSlotLabels,
} from '@shared/orderFormTimeSlotLabels';

const ALL_DAY_SELECT_OPTION = {
  value: ALL_DAY_PREFERRED_TIME_VALUE,
  label: '종일 (하루 한 건 · 오전·오후 슬롯 모두 사용)',
} as const;

export function canStaffSetAllDayPreferredTime(role: string | null | undefined): boolean {
  return role === 'ADMIN' || role === 'MARKETER';
}

export function withCurrentTimeSlotOption(
  options: Array<{ value: string; label: string }>,
  current?: string | null,
) {
  const v = current?.trim();
  if (!v || options.some((o) => o.value === v)) return options;
  return [...options, { value: v, label: v }];
}

export function buildStaffInquiryTimeSlotSelectOptions(
  labels: OrderTimeSlotLabels | null | undefined,
  role: string | null | undefined,
  current?: string | null,
  templateOptions?: string[] | null,
) {
  const base = buildTimeSlotOptionsForForm(templateOptions, labels);
  const withAllDay = canStaffSetAllDayPreferredTime(role) ? [...base, ALL_DAY_SELECT_OPTION] : base;
  return withCurrentTimeSlotOption(withAllDay, current);
}

export { ALL_DAY_PREFERRED_TIME_VALUE, isAllDayPreferredTime };
