/** 목록 카드의 현금영수증 발행 완료. 카드결제 완료 표시와 같은 크기. */
export function inquiryHasIssuedCashbill(item: object | null | undefined): boolean {
  const rows = relationRows(item, 'cashBillIssues');
  return Boolean(rows && rows.length > 0);
}

function relationRows(item: object | null | undefined, key: 'cashBillIssues' | 'taxInvoiceIssues'): { id: string }[] | null | undefined {
  if (!item || !(key in item)) return undefined;
  const value = (item as Record<string, unknown>)[key];
  return Array.isArray(value) ? (value as { id: string }[]) : undefined;
}

export function inquiryHasIssuedTaxInvoice(item: object | null | undefined): boolean {
  const rows = relationRows(item, 'taxInvoiceIssues');
  return Boolean(rows && rows.length > 0);
}

const receiptBadge = 'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-fluid-2xs font-medium border shrink-0';

/** 해피콜 완료 배지와 같은 크기. 취소만 남은 접수는 서버에서 빼 둔다. */
export function ReceiptIssuedBadges({ cash, tax }: { cash: boolean; tax: boolean }) {
  if (!cash && !tax) return null;
  return (
    <>
      {cash ? <span className={`${receiptBadge} border-green-200 bg-green-50 text-green-800`}>현금영수증 ✓</span> : null}
      {tax ? <span className={`${receiptBadge} border-sky-200 bg-sky-50 text-sky-800`}>세금계산서 ✓</span> : null}
    </>
  );
}

export function TaxInvoiceDoneMark({ issued }: { issued: boolean }) {
  if (!issued) return null;
  return (
    <span
      className="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-sky-600 text-white"
      title="세금계산서 발행"
      aria-label="세금계산서 발행"
    >
      <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <path d="M4 2.5h6.2L12.5 5v8.5H4z" />
        <path d="M10 2.5V5h2.5" />
        <path d="M6 8.5h4M6 11h3" strokeLinecap="round" />
      </svg>
    </span>
  );
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
