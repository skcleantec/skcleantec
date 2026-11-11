import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { cashbillStateLabel, listCashbillIssues, type CashbillIssueRow } from '../../../api/cashbillIssues';
import { listTaxInvoices, type TaxInvoiceRow } from '../../../api/taxInvoices';
import { ReceiptExtraNote } from '../../receipts/ReceiptExtraNote';

function dayOf(iso: string): string {
  return iso.slice(0, 10);
}

function won(value: number): string {
  return `${Number(value).toLocaleString('ko-KR')}원`;
}

const linkClass = 'inline-flex min-h-9 items-center rounded-lg border border-slate-300 bg-white px-2.5 text-fluid-xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2';

export function InquiryReceiptShelf({ inquiryId }: { inquiryId: string }) {
  const [cash, setCash] = useState<CashbillIssueRow[]>([]);
  const [tax, setTax] = useState<TaxInvoiceRow[]>([]);

  useEffect(() => {
    let stop = false;
    const qs = new URLSearchParams({ inquiryId, limit: '20', offset: '0' });
    listCashbillIssues(qs)
      .then((res) => { if (!stop) setCash(res.items); })
      .catch(() => { if (!stop) setCash([]); });
    listTaxInvoices(qs)
      .then((res) => { if (!stop) setTax(res.items); })
      .catch(() => { if (!stop) setTax([]); });
    return () => { stop = true; };
  }, [inquiryId]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Link className={linkClass} to={`/admin/inquiries/receipts/cashbill/new?inquiryId=${encodeURIComponent(inquiryId)}`}>현금영수증 발행</Link>
        <Link className={linkClass} to={`/admin/inquiries/receipts/taxinvoice/new?inquiryId=${encodeURIComponent(inquiryId)}`}>세금계산서 발행</Link>
      </div>
      {cash.length === 0 && tax.length === 0 ? (
        <p className="text-fluid-xs text-slate-500">아직 발행 내역이 없어요.</p>
      ) : (
        <ul className="space-y-1.5">
          {cash.map((row) => (
            <li key={`c-${row.id}`} className="rounded-lg border border-slate-200 px-2.5 py-1.5">
              <p className="text-fluid-xs text-slate-800">현금영수증 · {dayOf(row.createdAt)} · {won(row.totalWon)} · {row.cancelled ? '발급 취소됨' : cashbillStateLabel(row.barobillState, row.lastError)}</p>
              <ReceiptExtraNote amount={row.extraAmountWon} reason={row.extraReason} />
            </li>
          ))}
          {tax.map((row) => (
            <li key={`t-${row.id}`} className="rounded-lg border border-slate-200 px-2.5 py-1.5">
              <p className="text-fluid-xs text-slate-800">세금계산서 · {dayOf(row.createdAt)} · {won(row.totalAmount)} · {row.barobillState === '5031' ? '발급 취소됨' : row.lastError ? '실패' : row.barobillState === '3014' ? '발행됨' : '처리 중'}</p>
              <ReceiptExtraNote amount={row.extraAmountWon} reason={row.extraReason} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
