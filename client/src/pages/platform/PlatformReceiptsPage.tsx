import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  fetchPlatformReceiptCert,
  fetchPlatformReceiptIssuer,
  fetchWalletInvoiceQueueCount,
  type PlatformReceiptCert,
  type PlatformReceiptIssuer,
} from '../../api/platformReceipts';
import { PlatformCashbillTab } from './PlatformCashbillTab';
import { PlatformCertRegisterModal } from './PlatformCertRegisterModal';
import { PlatformIssueQueueTab } from './PlatformIssueQueueTab';
import { PlatformIssuedListTab } from './PlatformIssuedListTab';
import { PlatformTaxInvoiceTab } from './PlatformTaxInvoiceTab';
import { platformCertLineStatus } from './platformReceiptsFilters';

type TabId = 'queue' | 'issued' | 'cashbill' | 'taxinvoice';

function parseTab(raw: string | null, queueCount: number | null): TabId {
  if (raw === 'issued' || raw === 'cashbill' || raw === 'taxinvoice' || raw === 'queue') return raw;
  if (queueCount === null) return 'queue';
  return queueCount > 0 ? 'queue' : 'issued';
}

export function PlatformReceiptsPage() {
  const [params, setParams] = useSearchParams();
  const [queueCount, setQueueCount] = useState<number | null>(null);
  const tab = parseTab(params.get('tab'), queueCount);
  const [issuer, setIssuer] = useState<PlatformReceiptIssuer | null>(null);
  const [cert, setCert] = useState<PlatformReceiptCert | null>(null);
  const [showCertModal, setShowCertModal] = useState(false);

  useEffect(() => {
    fetchPlatformReceiptIssuer().then(setIssuer).catch(() => setIssuer(null));
    fetchPlatformReceiptCert().then(setCert).catch(() => setCert(null));
    fetchWalletInvoiceQueueCount()
      .then((count) => {
        setQueueCount(count);
        if (!params.get('tab')) {
          const next = new URLSearchParams(params);
          next.set('tab', count > 0 ? 'queue' : 'issued');
          setParams(next, { replace: true });
        }
      })
      .catch(() => setQueueCount(0));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 최초 기본 탭만
  }, []);

  const onQueueCount = useCallback((n: number) => {
    setQueueCount(n);
    window.dispatchEvent(new CustomEvent('cbiseo:receipts-queue', { detail: { count: n } }));
  }, []);

  function switchTab(id: TabId) {
    const next = new URLSearchParams(params);
    next.set('tab', id);
    if (id === 'queue' || id === 'issued') next.delete('page');
    setParams(next, { replace: true });
  }

  const certValid = cert?.valid === true;
  const certLine = useMemo(
    () => platformCertLineStatus(certValid, cert?.expireDate ?? null),
    [certValid, cert?.expireDate],
  );
  const issuerShort =
    (issuer?.corpName || '서비스브릿지').replace(/^주식회사\s*/, '').trim() || '서비스브릿지';

  const tabBtn = (id: TabId, label: string, badge?: number | null) => (
    <button
      type="button"
      className={[
        'inline-flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2',
        tab === id ? 'bg-slate-900 text-white' : 'text-gray-700 hover:bg-white',
      ].join(' ')}
      onClick={() => switchTab(id)}
    >
      {label}
      {typeof badge === 'number' && badge > 0 ? (
        <span
          className={[
            'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
            tab === id ? 'bg-amber-400/90 text-amber-950' : 'bg-amber-100 text-amber-800',
          ].join(' ')}
        >
          {badge}
        </span>
      ) : null}
    </button>
  );

  return (
    <div className="min-w-0 w-full max-w-6xl space-y-4 pb-8">
      {showCertModal ? (
        <PlatformCertRegisterModal
          onClose={() => setShowCertModal(false)}
          onRegistered={(c) => {
            setCert(c);
            setShowCertModal(false);
          }}
        />
      ) : null}

      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-gray-900">영수증</h1>
          <p className="mt-1 text-sm text-gray-500">플랫폼 명의로 현금영수증·세금계산서를 발행합니다.</p>
        </div>
        <div className="flex h-7 shrink-0 flex-wrap items-center gap-1.5 text-[12px] leading-7 text-[#64748B] sm:pt-0.5">
          <span>{issuerShort}</span>
          <span className="text-slate-300" aria-hidden>·</span>
          <span
            className={`inline-flex items-center gap-1.5 ${certLine.ok ? 'text-emerald-700' : 'text-amber-700'}`}
          >
            <span
              className={`size-1.5 shrink-0 rounded-full ${certLine.ok ? 'bg-emerald-500' : 'bg-amber-500'}`}
              aria-hidden
            />
            {certLine.label}
          </span>
          <button
            type="button"
            className="inline-flex h-7 items-center px-0.5 text-[12px] font-medium text-sky-600 hover:text-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
            onClick={() => setShowCertModal(true)}
          >
            {certLine.action}
          </button>
        </div>
      </div>

      <div className="inline-flex flex-wrap gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5">
        {tabBtn('queue', '발행할 목록', queueCount)}
        {tabBtn('issued', '발행 목록')}
        {tabBtn('cashbill', '현금영수증')}
        {tabBtn('taxinvoice', '세금계산서')}
        {tab === 'taxinvoice' && !certValid ? (
          <span className="self-center px-2 text-[10px] font-semibold text-amber-800">인증서 필요</span>
        ) : null}
      </div>

      {tab === 'queue' ? <PlatformIssueQueueTab onQueueCount={onQueueCount} /> : null}
      {tab === 'issued' ? <PlatformIssuedListTab /> : null}
      {tab === 'cashbill' ? <PlatformCashbillTab /> : null}
      {tab === 'taxinvoice' ? <PlatformTaxInvoiceTab certValid={certValid} /> : null}
    </div>
  );
}
