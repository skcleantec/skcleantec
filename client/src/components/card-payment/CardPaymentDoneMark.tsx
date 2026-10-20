export function inquiryHasApprovedCardPayment(item: {
  cardPayments?: { id: string }[] | null;
}): boolean {
  return Boolean(item.cardPayments && item.cardPayments.length > 0);
}

/** 카드결재가 승인된 접수에 붙는 작은 원형 표시. */
export function CardPaymentDoneMark({ paid }: { paid: boolean }) {
  if (!paid) return null;
  return (
    <span
      title="카드결재 완료"
      aria-label="카드결재 완료"
      className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-600"
    >
      <span className="block h-2.5 w-3.5 rounded-sm border border-white" aria-hidden />
    </span>
  );
}
