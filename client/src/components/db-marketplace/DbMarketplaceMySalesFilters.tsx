import { useMemo } from 'react';
import { YearMonthSelect, YmdSelect } from '../ui/DateQuerySelects';
import { kstTodayYmd } from '../../utils/dateFormat';
import type {
  DbMarketplaceAudienceOptionExternal,
  DbMarketplaceAudienceOptionPartner,
} from '../../api/dbMarketplace';

export type DbMarketplaceMySalesFilterState = {
  buyerKind: '' | 'PARTNER_TENANT' | 'EXTERNAL_COMPANY';
  buyerId: string;
  soldDatePreset: 'today' | 'all' | 'month' | 'day';
  soldMonth: string;
  soldDay: string;
  handoverDatePreset: 'today' | 'all' | 'month' | 'day';
  handoverMonth: string;
  handoverDay: string;
};

export function parseMySalesFiltersFromSearchParams(sp: URLSearchParams): DbMarketplaceMySalesFilterState {
  const buyerKindRaw = sp.get('buyerKind')?.trim() ?? '';
  const buyerKind =
    buyerKindRaw === 'PARTNER_TENANT' || buyerKindRaw === 'EXTERNAL_COMPANY' ? buyerKindRaw : '';

  const soldPresetRaw = sp.get('soldDatePreset')?.trim() ?? '';
  const soldDatePreset =
    soldPresetRaw === 'today' || soldPresetRaw === 'month' || soldPresetRaw === 'day'
      ? soldPresetRaw
      : 'all';

  const handoverPresetRaw = sp.get('handoverDatePreset')?.trim() ?? '';
  const handoverDatePreset =
    handoverPresetRaw === 'today' || handoverPresetRaw === 'month' || handoverPresetRaw === 'day'
      ? handoverPresetRaw
      : 'all';

  return {
    buyerKind,
    buyerId: sp.get('buyerId')?.trim() ?? '',
    soldDatePreset,
    soldMonth: sp.get('soldMonth')?.trim() || kstTodayYmd().slice(0, 7),
    soldDay: sp.get('soldDay')?.trim() || kstTodayYmd(),
    handoverDatePreset,
    handoverMonth: sp.get('handoverMonth')?.trim() || kstTodayYmd().slice(0, 7),
    handoverDay: sp.get('handoverDay')?.trim() || kstTodayYmd(),
  };
}

export function mySalesFiltersToApiParams(filters: DbMarketplaceMySalesFilterState): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.buyerKind && filters.buyerId) {
    params.buyerKind = filters.buyerKind;
    params.buyerId = filters.buyerId;
  }
  if (filters.soldDatePreset !== 'all') {
    params.soldDatePreset = filters.soldDatePreset;
    if (filters.soldDatePreset === 'month') params.soldMonth = filters.soldMonth;
    if (filters.soldDatePreset === 'day') params.soldDay = filters.soldDay;
  }
  if (filters.handoverDatePreset !== 'all') {
    params.handoverDatePreset = filters.handoverDatePreset;
    if (filters.handoverDatePreset === 'month') params.handoverMonth = filters.handoverMonth;
    if (filters.handoverDatePreset === 'day') params.handoverDay = filters.handoverDay;
  }
  return params;
}

export function applyMySalesFiltersToSearchParams(
  base: URLSearchParams,
  filters: DbMarketplaceMySalesFilterState,
): URLSearchParams {
  const next = new URLSearchParams(base);
  for (const key of [
    'buyerKind',
    'buyerId',
    'soldDatePreset',
    'soldMonth',
    'soldDay',
    'handoverDatePreset',
    'handoverMonth',
    'handoverDay',
  ]) {
    next.delete(key);
  }
  const api = mySalesFiltersToApiParams(filters);
  for (const [k, v] of Object.entries(api)) {
    next.set(k, v);
  }
  return next;
}

const DATE_PRESET_OPTIONS = [
  { id: 'today' as const, label: '당일' },
  { id: 'all' as const, label: '전체' },
  { id: 'month' as const, label: '월별' },
  { id: 'day' as const, label: '날짜' },
];

function DatePresetSegment({
  label,
  preset,
  month,
  day,
  onPresetChange,
  onMonthChange,
  onDayChange,
}: {
  label: string;
  preset: 'today' | 'all' | 'month' | 'day';
  month: string;
  day: string;
  onPresetChange: (next: 'today' | 'all' | 'month' | 'day') => void;
  onMonthChange: (next: string) => void;
  onDayChange: (next: string) => void;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <p className="text-fluid-2xs font-medium text-gray-600">{label}</p>
      <div className="inline-flex max-w-full flex-nowrap gap-1 overflow-x-auto rounded-lg border border-gray-200 bg-gray-50 p-1">
        {DATE_PRESET_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onPresetChange(opt.id)}
            className={`shrink-0 rounded-md px-2.5 py-1.5 text-fluid-2xs font-medium whitespace-nowrap ${
              preset === opt.id ? 'bg-slate-900 text-white' : 'text-gray-600 hover:bg-white'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {preset === 'month' ? (
        <YearMonthSelect value={month} onChange={onMonthChange} className="w-full max-w-[12rem]" />
      ) : null}
      {preset === 'day' ? (
        <YmdSelect value={day} onChange={onDayChange} className="w-full max-w-[14rem]" />
      ) : null}
    </div>
  );
}

export function DbMarketplaceMySalesFilters({
  filters,
  partners,
  externalCompanies,
  onChange,
}: {
  filters: DbMarketplaceMySalesFilterState;
  partners: DbMarketplaceAudienceOptionPartner[];
  externalCompanies: DbMarketplaceAudienceOptionExternal[];
  onChange: (next: DbMarketplaceMySalesFilterState) => void;
}) {
  const buyerSelectValue = useMemo(() => {
    if (!filters.buyerKind || !filters.buyerId) return '';
    return `${filters.buyerKind}:${filters.buyerId}`;
  }, [filters.buyerKind, filters.buyerId]);

  const buyerOptions = useMemo(() => {
    const opts: Array<{ value: string; label: string }> = [];
    for (const p of partners) {
      opts.push({ value: `PARTNER_TENANT:${p.id}`, label: `[파트너] ${p.name}` });
    }
    for (const e of externalCompanies) {
      opts.push({ value: `EXTERNAL_COMPANY:${e.id}`, label: `[타업체] ${e.name}` });
    }
    return opts.sort((a, b) => a.label.localeCompare(b.label, 'ko'));
  }, [partners, externalCompanies]);

  return (
    <div className="mb-4 space-y-4 rounded-xl border border-gray-200 bg-gray-50/80 p-3 sm:p-4">
      <div className="min-w-0 space-y-2">
        <p className="text-fluid-2xs font-medium text-gray-600">인계업체</p>
        <select
          value={buyerSelectValue}
          onChange={(e) => {
            const v = e.target.value;
            if (!v) {
              onChange({ ...filters, buyerKind: '', buyerId: '' });
              return;
            }
            const [kind, id] = v.split(':') as ['PARTNER_TENANT' | 'EXTERNAL_COMPANY', string];
            onChange({ ...filters, buyerKind: kind, buyerId: id });
          }}
          className="w-full max-w-md rounded-lg border border-gray-300 bg-white px-3 py-2 text-fluid-xs text-gray-800"
        >
          <option value="">전체 업체</option>
          {buyerOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <DatePresetSegment
          label="판매날짜 (게시일)"
          preset={filters.soldDatePreset}
          month={filters.soldMonth}
          day={filters.soldDay}
          onPresetChange={(soldDatePreset) => onChange({ ...filters, soldDatePreset })}
          onMonthChange={(soldMonth) => onChange({ ...filters, soldMonth })}
          onDayChange={(soldDay) => onChange({ ...filters, soldDay })}
        />
        <DatePresetSegment
          label="인계날짜"
          preset={filters.handoverDatePreset}
          month={filters.handoverMonth}
          day={filters.handoverDay}
          onPresetChange={(handoverDatePreset) => onChange({ ...filters, handoverDatePreset })}
          onMonthChange={(handoverMonth) => onChange({ ...filters, handoverMonth })}
          onDayChange={(handoverDay) => onChange({ ...filters, handoverDay })}
        />
      </div>
    </div>
  );
}
