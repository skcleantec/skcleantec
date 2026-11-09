import {
  parseReceiptKind,
  parseReceiptPeriod,
  parseReceiptStatus,
  resolveReceiptDateRange,
  type ReceiptKindFilter,
  type ReceiptPeriod,
  type ReceiptStatusFilter,
} from './platformReceiptsFilters';
import { BTN_SECONDARY, INPUT_BASE } from '../../utils/platformUi';

const PERIODS: { id: ReceiptPeriod; label: string }[] = [
  { id: 'thisMonth', label: '이번 달' },
  { id: 'lastMonth', label: '지난 달' },
  { id: 'last3Months', label: '최근 3개월' },
  { id: 'custom', label: '직접' },
];

const STATUSES: { id: ReceiptStatusFilter; label: string }[] = [
  { id: '', label: '전체' },
  { id: 'ISSUED', label: '발행' },
  { id: 'CANCELLED', label: '취소' },
  { id: 'FAILED', label: '실패' },
];

const KINDS: { id: ReceiptKindFilter; label: string }[] = [
  { id: '', label: '종류 전체' },
  { id: 'cashbill', label: '현금영수증' },
  { id: 'taxinvoice', label: '세금계산서' },
];

export function PlatformReceiptsFilterBar({
  params,
  onChange,
  onExport,
  exporting,
  showKind = false,
}: {
  params: URLSearchParams;
  onChange: (patch: Record<string, string | null>, resetPage?: boolean) => void;
  onExport: () => void;
  exporting?: boolean;
  showKind?: boolean;
}) {
  const period = parseReceiptPeriod(params.get('period'));
  const status = parseReceiptStatus(params.get('status'));
  const kind = parseReceiptKind(params.get('kind'));
  const from = params.get('from') || '';
  const to = params.get('to') || '';
  const q = params.get('q') || '';
  const range = resolveReceiptDateRange({ period, from, to });

  return (
    <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {PERIODS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={[
              'rounded-md px-2.5 py-1.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2',
              period === item.id ? 'bg-slate-900 text-white' : 'border border-gray-200 text-gray-700 hover:bg-gray-50',
            ].join(' ')}
            onClick={() => {
              if (item.id === 'custom') {
                onChange({ period: 'custom', from: range.from, to: range.to }, true);
              } else {
                onChange({ period: item.id, from: null, to: null }, true);
              }
            }}
          >
            {item.label}
          </button>
        ))}
        {period === 'custom' ? (
          <>
            <input
              type="date"
              className={`${INPUT_BASE} !w-auto !py-1 text-xs`}
              value={from || range.from}
              onChange={(e) => onChange({ period: 'custom', from: e.target.value }, true)}
            />
            <span className="text-xs text-gray-400">~</span>
            <input
              type="date"
              className={`${INPUT_BASE} !w-auto !py-1 text-xs`}
              value={to || range.to}
              onChange={(e) => onChange({ period: 'custom', to: e.target.value }, true)}
            />
          </>
        ) : null}
        {showKind ? (
          <select
            className={`${INPUT_BASE} !w-auto !py-1.5 text-xs`}
            value={kind}
            onChange={(e) => onChange({ kind: e.target.value || null }, true)}
          >
            {KINDS.map((item) => (
              <option key={item.id || 'all-kind'} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        ) : null}
        <select
          className={`${INPUT_BASE} !w-auto !py-1.5 text-xs`}
          value={status}
          onChange={(e) => onChange({ status: e.target.value || null }, true)}
        >
          {STATUSES.map((item) => (
            <option key={item.id || 'all'} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
        <input
          className={`${INPUT_BASE} min-w-[10rem] flex-1 !py-1.5 text-xs`}
          placeholder="업체·고객 이름 검색"
          value={q}
          onChange={(e) => onChange({ q: e.target.value || null }, true)}
        />
        <button type="button" className={BTN_SECONDARY} disabled={exporting} onClick={onExport}>
          {exporting ? '받는 중…' : '엑셀 받기'}
        </button>
      </div>
      <p className="text-xs text-gray-500">조회 기간: {range.label}</p>
    </div>
  );
}

export function useReceiptFilterRange(params: URLSearchParams) {
  return resolveReceiptDateRange({
    period: parseReceiptPeriod(params.get('period')),
    from: params.get('from') || '',
    to: params.get('to') || '',
  });
}
