import { useState } from 'react';
import { WALLET_LOW_BALANCE_KRW } from '@shared/walletPolicy';
import { openTenantWalletTaxInvoiceView } from '../../api/receiptWallet';
import { useReceiptWallet } from './ReceiptWalletProvider';

function won(n: number): string {
  return `${Number(n).toLocaleString('ko-KR')}원`;
}

function formatMd(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${pick('month')}.${pick('day')}`;
}

const BTN =
  'min-h-10 rounded-lg bg-slate-900 px-3 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
const BTN_GHOST =
  'min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-fluid-xs font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';
const VIEW_BTN =
  'inline min-h-7 rounded border border-slate-300 bg-white px-1.5 text-fluid-2xs text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none';

export function ReceiptWalletCard() {
  const { summary, openCharge, openHistory } = useReceiptWallet();
  const [viewBusy, setViewBusy] = useState(false);
  const [viewError, setViewError] = useState<string | null>(null);
  const low = summary != null && summary.balanceKrw < WALLET_LOW_BALANCE_KRW;
  const latest = summary?.latestCharge;

  const openLatestTax = async () => {
    if (!latest?.taxInvoice.canView) return;
    setViewBusy(true);
    setViewError(null);
    try {
      await openTenantWalletTaxInvoiceView({
        walletInvoiceId: latest.taxInvoice.walletInvoiceId,
        paymentId: latest.taxInvoice.paymentId,
      });
    } catch (err: unknown) {
      setViewError(err instanceof Error ? err.message : '영수증을 열 수 없습니다.');
    } finally {
      setViewBusy(false);
    }
  };

  return (
    <section className={`rounded-xl border p-2 sm:p-3 ${low ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white'}`}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-fluid-2xs text-slate-600">청소비서 지갑</p>
          <p className={`text-fluid-lg font-semibold tabular-nums ${low ? 'text-amber-950' : 'text-slate-900'}`}>
            {summary ? won(summary.balanceKrw) : '불러오는 중'}
          </p>
        </div>
        {low ? <p className="text-fluid-xs font-medium text-amber-900">곧 발행이 멈춥니다</p> : null}
      </div>
      <p className="mt-1 text-fluid-2xs leading-snug text-slate-700">
        이번 달 사용 · 현금영수증 {summary?.month.cashbillCount ?? 0}건 {won(summary?.month.cashbillKrw ?? 0)}
        {' · '}세금계산서 {summary?.month.taxInvoiceCount ?? 0}건 {won(summary?.month.taxInvoiceKrw ?? 0)}
        {' · '}알림톡 {won(summary?.month.alimtalkKrw ?? 0)}
      </p>
      {summary && summary.pendingChargeKrw > 0 ? (
        <p className="mt-1 text-fluid-2xs text-amber-900">충전 신청 중 {won(summary.pendingChargeKrw)}</p>
      ) : null}
      {latest ? (
        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-fluid-2xs leading-snug text-slate-700">
          <span>
            {formatMd(latest.createdAt)} 충전 {won(latest.amountKrw)}
          </span>
          <span className="text-slate-400">·</span>
          <span>세금계산서 {latest.taxInvoice.label}</span>
          {latest.taxInvoice.canView ? (
            <button type="button" className={VIEW_BTN} disabled={viewBusy} onClick={() => void openLatestTax()}>
              보기
            </button>
          ) : null}
        </p>
      ) : null}
      {viewError ? <p className="mt-1 text-fluid-2xs text-red-700">{viewError}</p> : null}
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className={BTN} onClick={() => openCharge()}>충전하기</button>
        <button type="button" className={BTN_GHOST} onClick={openHistory}>충전·사용 내역 보기</button>
      </div>
    </section>
  );
}
