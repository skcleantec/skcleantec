/** 목록 카드의 현금영수증 발행 완료. 카드결제 완료 표시와 같은 크기. */
export function inquiryHasIssuedCashbill(item: { cashBillIssues?: { id: string }[] | null }): boolean {
  return Boolean(item.cashBillIssues && item.cashBillIssues.length > 0);
}

export function CashbillDoneMark({ issued }: { issued: boolean }) {
  if (!issued) return null;
  return (
    <span
      className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white"
      title="현금영수증 발행"
      aria-label="현금영수증 발행"
    >
      <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <path d="M4 2.5h6.2L12.5 5v8.5H4z" />
        <path d="M10 2.5V5h2.5" />
        <path d="M6 8.5h4M6 11h3" strokeLinecap="round" />
      </svg>
    </span>
  );
}
