import type { ScheduleItem } from '../../../api/schedule';

export function isInquiryLinkedOrderFormPendingSubmit(item: ScheduleItem): boolean {
  if (item.status === 'ORDER_FORM_PENDING') return true;
  return Boolean(
    item.orderForm?.id &&
      !item.orderForm.submittedAt &&
      (item.status === 'PENDING' || item.status === 'DEPOSIT_COMPLETED'),
  );
}
