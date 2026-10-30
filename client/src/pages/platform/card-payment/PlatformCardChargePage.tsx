import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { fetchPlatformSellerCenterStatus, revealPlatformSellerCenter } from '../../../api/platformCardPayment';
import { openSellerCenterLoggedIn } from '../../../utils/openSellerCenterLogin';
import { PlatformCardPaymentTabs } from './PlatformCardPaymentTabs';
import { Button } from '../../../components/ui/Button';
import { PlatformUsageFeeKeyinForm } from './PlatformUsageFeeKeyinForm';
import { PlatformPayLinkPanel } from './PlatformPayLinkPanel';
import { PlatformPayHistory } from './PlatformPayHistory';
import type { PayLinkSeed } from './keyinPayUi';

const TABS = [
  { id: 'keyin', label: '수기 결제' },
  { id: 'link', label: '링크 결제' },
  { id: 'list', label: '결제 내역' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function tabOf(raw: string | null): TabId {
  if (raw === 'keyin' || raw === 'list' || raw === 'link') return raw;
  return 'link';
}

export function PlatformCardChargePage() {
  const [params, setParams] = useSearchParams();
  const tab = tabOf(params.get('tab'));
  const [sellerSaved, setSellerSaved] = useState<boolean | null>(null);
  const [sellerError, setSellerError] = useState<string | null>(null);
  const [linkSeed, setLinkSeed] = useState<PayLinkSeed | null>(null);

  function openTab(id: TabId) {
    const next = new URLSearchParams(params);
    next.set('tab', id);
    next.set('page', '1');
    setParams(next, { replace: true });
  }

  useEffect(() => {
    void fetchPlatformSellerCenterStatus()
      .then((row) => setSellerSaved(row.saved))
      .catch(() => setSellerSaved(false));
  }, []);

  function openSellerCenter() {
    setSellerError(null);
    void revealPlatformSellerCenter()
      .then((row) => {
        const opened = openSellerCenterLoggedIn(row.loginId, row.password);
        if (!opened) setSellerError('팝업이 막혀 판매자센터를 열지 못했습니다.');
      })
      .catch((e: unknown) => setSellerError(e instanceof Error ? e.message : '판매자센터를 열지 못했습니다.'));
  }

  return (
    <div className="min-w-0 w-full max-w-5xl space-y-4 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-xs text-gray-500">플랫폼 › 매출·수납</p>
          <h1 className="text-xl font-semibold text-[#111a2b]">카드결제</h1>
          <p className="max-w-xl text-sm leading-relaxed text-gray-600">
            서비스브릿지 가맹으로 받습니다. 고객 카드 영수증에는 서비스브릿지가 찍힙니다.
          </p>
        </div>
        {sellerSaved ? (
          <Button size="md" variant="secondary" onClick={openSellerCenter}>원성페이 바로가기 ↗</Button>
        ) : sellerSaved === false ? (
          <p className="max-w-xs text-sm text-gray-600">
            판매자센터 아이디가 저장돼 있지 않아요. 원성 파트너의 서비스브릿지 판매자센터에 아이디를 저장하세요.
          </p>
        ) : null}
      </div>
      {sellerError ? <p className="text-sm text-red-700">{sellerError}</p> : null}
      <PlatformCardPaymentTabs />
      <div className="flex gap-1 overflow-x-auto border-b border-gray-200" role="tablist">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`whitespace-nowrap border-b-2 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1f4fb8] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
              tab === item.id ? 'border-[#111a2b] font-semibold text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
            onClick={() => openTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <section className={tab === 'keyin' ? '' : 'rounded-2xl border border-gray-200 bg-white p-4'}>
        {tab === 'keyin' ? (
          <PlatformUsageFeeKeyinForm
            onPaid={() => undefined}
            onOpenHistory={() => openTab('list')}
            onSendLink={(seed) => {
              setLinkSeed(seed);
              openTab('link');
            }}
          />
        ) : null}
        {tab === 'link' ? <PlatformPayLinkPanel seed={linkSeed} /> : null}
        {tab === 'list' ? <PlatformPayHistory /> : null}
      </section>
    </div>
  );
}
