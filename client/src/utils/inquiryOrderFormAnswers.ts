import type { ScheduleItem } from '../api/schedule';

/** 접수수정 초기값 — 제출본 우선, 없으면 선입력. 발주서 없으면 전화 접수 때 적은 추가 칸. */
export function inquiryOrderFormAnswersFromItem(
  item:
    | (Pick<ScheduleItem, 'orderForm'> & { intakeCustomAnswers?: Record<string, unknown> | null })
    | { orderForm?: ScheduleItem['orderForm']; intakeCustomAnswers?: Record<string, unknown> | null }
    | null
    | undefined,
): Record<string, unknown> {
  const of = item?.orderForm;
  if (of) {
    const submitted = of.customerAnswers && typeof of.customerAnswers === 'object' ? of.customerAnswers : {};
    const prefill = of.prefillAnswers && typeof of.prefillAnswers === 'object' ? of.prefillAnswers : {};
    if (of.submittedAt) return { ...submitted };
    return { ...prefill, ...submitted };
  }
  const pending = item?.intakeCustomAnswers;
  if (pending && typeof pending === 'object' && !Array.isArray(pending)) return { ...pending };
  return {};
}
