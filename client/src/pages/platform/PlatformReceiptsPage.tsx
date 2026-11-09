import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  fetchPlatformReceiptCert,
  fetchPlatformReceiptIssuer,
  type PlatformReceiptCert,
  type PlatformReceiptIssuer,
} from '../../api/platformReceipts';
import { BTN_SECONDARY, CARD_SECTION } from '../../utils/platformUi';
import { PlatformCashbillTab } from './PlatformCashbillTab';
import { PlatformCertRegisterModal } from './PlatformCertRegisterModal';
import { PlatformTaxInvoiceTab } from './PlatformTaxInvoiceTab';
import { formatCertExpireDot } from './platformReceiptsFilters';

type TabId = 'cashbill' | 'taxinvoice';

export function PlatformReceiptsPage() {
  const [params, setParams] = useSearchParams();
  const tab: TabId = params.get('tab') === 'taxinvoice' ? 'taxinvoice' : 'cashbill';
  const [issuer, setIssuer] = useState<PlatformReceiptIssuer | null>(null);
  const [cert, setCert] = useState<PlatformReceiptCert | null>(null);
  const [showCertModal, setShowCertModal] = useState(false);

  useEffect(() => {
    fetchPlatformReceiptIssuer().then(setIssuer).catch(() => setIssuer(null));
    fetchPlatformReceiptCert().then(setCert).catch(() => setCert(null));
  }, []);

  function switchTab(id: TabId) {
    const next = new URLSearchParams(params);
    next.set('tab', id);
    setParams(next, { replace: true });
  }

  const certValid = cert?.valid === true;
  const expireDot = formatCertExpireDot(cert?.expireDate ?? null);
  const corpLine = [
    issuer?.corpName || '주식회사 서비스브릿지',
    issuer?.corpNumDisplay || issuer?.corpNumMasked || '',
  ]
    .filter(Boolean)
    .join(' · ');

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

      <div>
        <h1 className="text-xl font-semibold text-gray-900">영수증</h1>
        <p className="mt-1 text-sm text-gray-500">플랫폼 명의로 현금영수증·세금계산서를 발행합니다.</p>
      </div>

      <section className={`${CARD_SECTION} flex flex-wrap items-center justify-between gap-3`}>
        <p className="text-sm text-gray-800">
          {corpLine}
          <span className="mx-1.5 text-gray-300">·</span>
          {certValid ? (
            <span className="text-emerald-700">
              공동인증서 ✓ 등록됨{expireDot ? `(만료 ${expireDot})` : ''}
            </span>
          ) : (
            <span className="text-amber-700">공동인증서 미등록</span>
          )}
        </p>
        <button type="button" className={BTN_SECONDARY} onClick={() => setShowCertModal(true)}>
          인증서 등록·갱신
        </button>
      </section>

      <div className="inline-flex flex-wrap gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5">
        <button
          type="button"
          className={[
            'rounded-md px-4 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2',
            tab === 'cashbill' ? 'bg-slate-900 text-white' : 'text-gray-700 hover:bg-white',
          ].join(' ')}
          onClick={() => switchTab('cashbill')}
        >
          현금영수증
        </button>
        <button
          type="button"
          className={[
            'inline-flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2',
            tab === 'taxinvoice' ? 'bg-slate-900 text-white' : 'text-gray-700 hover:bg-white',
          ].join(' ')}
          onClick={() => switchTab('taxinvoice')}
        >
          세금계산서
          {!certValid ? (
            <span
              className={[
                'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                tab === 'taxinvoice' ? 'bg-amber-400/90 text-amber-950' : 'bg-amber-100 text-amber-800',
              ].join(' ')}
            >
              인증서 필요
            </span>
          ) : null}
        </button>
      </div>

      {tab === 'cashbill' ? <PlatformCashbillTab /> : <PlatformTaxInvoiceTab certValid={certValid} />}
    </div>
  );
}
