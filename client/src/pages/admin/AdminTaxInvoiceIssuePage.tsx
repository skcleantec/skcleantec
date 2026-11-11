import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { TAXINVOICE_UNIT_PRICE_KRW } from '@shared/barobillPolicy';
import { ReceiptWalletProvider, useReceiptWallet } from '../../components/wallet/ReceiptWalletProvider';
import { ReceiptSetupGate } from '../../components/receipts/ReceiptSetupGate';
import { TaxInvoiceIssueWorkspace } from '../../components/taxinvoice/TaxInvoiceIssueWorkspace';
import { LineMdIcon } from '../../components/ui/LineMdIcon';

const LIST_PATH = '/admin/inquiries/receipts/taxinvoice';

function won(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`;
}

function AdminTaxInvoiceIssueInner() {
  const navigate = useNavigate();
  const { summary } = useReceiptWallet();
  const dirtyRef = useRef(false);

  function goBack() {
    if (dirtyRef.current && !window.confirm('작성 중인 내용이 있어요. 나갈까요?')) return;
    navigate(LIST_PATH);
  }

  return (
    <div className="flex min-w-0 w-full flex-col gap-3">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="목록으로"
          onClick={goBack}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
        >
          <LineMdIcon name="arrow-left" className="size-4" />
        </button>
        <h1 className="text-[22px] font-bold text-slate-900">세금계산서 발행</h1>
        <div className="ml-auto shrink-0 text-[12px] text-[#64748B]">
          지갑 {summary ? won(summary.balanceKrw) : '…'} · 건당 {won(TAXINVOICE_UNIT_PRICE_KRW)}
        </div>
      </div>
      <TaxInvoiceIssueWorkspace pageLayout onDirtyChange={(dirty) => { dirtyRef.current = dirty; }} />
    </div>
  );
}

export function AdminTaxInvoiceIssuePage() {
  return (
    <ReceiptWalletProvider>
      <ReceiptSetupGate kind="taxinvoice">
        <div className="w-full lg:w-[1120px] lg:max-w-[1120px]">
          <AdminTaxInvoiceIssueInner />
        </div>
      </ReceiptSetupGate>
    </ReceiptWalletProvider>
  );
}
