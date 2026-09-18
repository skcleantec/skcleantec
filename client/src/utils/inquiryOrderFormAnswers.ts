import type { ScheduleItem } from '../api/schedule';

/** 접수수정 초기값 — 제출본 우선, 없으면 선입력. 고객 폼과 같은 저장소를 읽는다. */
export function inquiryOrderFormAnswersFromItem(
  item: Pick<ScheduleItem, 'orderForm'> | { orderForm?: ScheduleItem['orderForm'] } | null | undefined,
): Record<string, unknown> {
  const of = item?.orderForm;
  if (!of) return {};
  const submitted = of.customerAnswers && typeof of.customerAnswers === 'object' ? of.customerAnswers : {};
  const prefill = of.prefillAnswers && typeof of.prefillAnswers === 'object' ? of.prefillAnswers : {};
  if (of.submittedAt) return { ...submitted };
  return { ...prefill, ...submitted };
}
