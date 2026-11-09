import { useSearchParams } from 'react-router-dom';
import { PlatformCashbillTab } from './PlatformCashbillTab';
import { PlatformTaxInvoiceTab } from './PlatformTaxInvoiceTab';

type TabId = 'cashbill' | 'taxinvoice';

const TABS: { id: TabId; label: string }[] = [
  { id: 'cashbill', label: '현금영수증' },
  { id: 'taxinvoice', label: '세금계산서' },
];

export function PlatformReceiptsPage() {
  const [params, setParams] = useSearchParams();
  const tab: TabId = params.get('tab') === 'taxinvoice' ? 'taxinvoice' : 'cashbill';

  function switchTab(id: TabId) {
    const next = new URLSearchParams(params);
    next.set('tab', id);
    setParams(next, { replace: true });
  }

  return (
    <div className="min-w-0 w-full max-w-6xl space-y-4 pb-8">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">영수증</h1>
        <p className="mt-1 text-sm text-gray-500">플랫폼 명의로 현금영수증·세금계산서를 발행합니다.</p>
      </div>

      {/* 탭 선택 */}
      <div className="inline-flex flex-wrap gap-0.5 rounded-lg border border-gray-200 bg-gray-50 p-0.5">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={[
              'rounded-md px-4 py-1.5 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2',
              tab === id ? 'bg-slate-900 text-white' : 'text-gray-700 hover:bg-white',
            ].join(' ')}
            onClick={() => switchTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'cashbill' ? <PlatformCashbillTab /> : <PlatformTaxInvoiceTab />}
    </div>
  );
}
