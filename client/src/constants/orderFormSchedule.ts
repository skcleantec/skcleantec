import {
  DEFAULT_ORDER_TIME_SLOT_LABELS,
  ORDER_TIME_SLOT_VALUES,
  buildOrderTimeSlotOptions,
  labelForTimeSlotFromLabels,
  shortTimeSlotLabelFromLabels,
  type OrderTimeSlot,
  type OrderTimeSlotLabels,
  type OrderTimeSlotLabelsJson,
} from '@shared/orderFormTimeSlotLabels';

export type { OrderTimeSlot, OrderTimeSlotLabels, OrderTimeSlotLabelsJson };

/** @deprecated buildOrderTimeSlotOptions(labels) 사용 — 기본 라벨 3개 */
export const ORDER_TIME_SLOT_OPTIONS = buildOrderTimeSlotOptions();

/** 사이청소 선택 시 구체적 시각(7번) 필수 */
export function isPreferredTimeDetailRequired(slot: string | null | undefined): boolean {
  return slot === '사이청소';
}

export function labelForTimeSlot(
  value: string | null | undefined,
  labels?: OrderTimeSlotLabelsJson | OrderTimeSlotLabels | null,
): string {
  return labelForTimeSlotFromLabels(value, labels);
}

/** 목록용 짧은 표기: 오전 / 오후 / 사이 */
export function shortTimeSlotLabel(
  value: string | null | undefined,
  labels?: OrderTimeSlotLabelsJson | OrderTimeSlotLabels | null,
): string {
  return shortTimeSlotLabelFromLabels(value, labels);
}

export { DEFAULT_ORDER_TIME_SLOT_LABELS, ORDER_TIME_SLOT_VALUES, buildOrderTimeSlotOptions };
