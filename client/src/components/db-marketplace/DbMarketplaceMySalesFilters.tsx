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
  groupByCompany: boolean;
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

  const groupRaw = sp.get('groupByCompany')?.trim() ?? '';
  const groupByCompany = groupRaw === '1' || groupRaw === 'true';

  return {
    buyerKind: groupByCompany ? '' : buyerKind,
    buyerId: groupByCompany ? '' : sp.get('buyerId')?.trim() ?? '',
    groupByCompany,
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
  if (filters.groupByCompany) {
    params.groupByCompany = '1';
  } else if (filters.buyerKind && filters.buyerId) {
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
    'groupByCompany',
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

function CompactDatePreset({
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
    <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-1.5">
      <span className="shrink-0 text-fluid-2xs font-medium text-gray-600 whitespace-nowrap">{label}</span>
      <div className="inline-flex max-w-full flex-nowrap gap-0.5 overflow-x-auto rounded-md border border-gray-200 bg-white p-0.5 [scrollbar-width:thin]">
        {DATE_PRESET_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onPresetChange(opt.id)}
            className={`shrink-0 rounded px-2 py-1 text-[10px] font-medium whitespace-nowrap sm:text-fluid-2xs ${
              preset === opt.id ? 'bg-slate-900 text-white' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {preset === 'month' ? (
        <YearMonthSelect value={month} onChange={onMonthChange} className="min-w-0 shrink" />
      ) : null}
      {preset === 'day' ? (
        <YmdSelect value={day} onChange={onDayChange} className="min-w-0 shrink" />
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
    <div className="mb-3 rounded-xl border border-gray-200 bg-gray-50/80 p-2 sm:p-3">
      <div className="flex min-w-0 flex-col gap-2 xl:flex-row xl:flex-wrap xl:items-center xl:gap-x-4 xl:gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
          <span className="shrink-0 text-fluid-2xs font-medium text-gray-600">인계업체</span>
          <select
            value={buyerSelectValue}
            disabled={filters.groupByCompany}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) {
                onChange({ ...filters, buyerKind: '', buyerId: '', groupByCompany: false });
                return;
              }
              const [kind, id] = v.split(':') as ['PARTNER_TENANT' | 'EXTERNAL_COMPANY', string];
              onChange({ ...filters, buyerKind: kind, buyerId: id, groupByCompany: false });
            }}
            className="min-w-0 max-w-full flex-1 rounded-md border border-gray-300 bg-white px-2 py-1.5 text-fluid-2xs text-gray-800 disabled:bg-gray-100 sm:max-w-[11rem] sm:text-fluid-xs"
          >
            <option value="">전체</option>
            {buyerOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() =>
              onChange({
                ...filters,
                groupByCompany: !filters.groupByCompany,
                buyerKind: '',
                buyerId: '',
              })
            }
            className={`shrink-0 rounded-md border px-2 py-1.5 text-fluid-2xs font-medium whitespace-nowrap sm:text-fluid-xs ${
              filters.groupByCompany
                ? 'border-slate-900 bg-slate-900 text-white'
                : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            업체별 보기
          </button>
        </div>

        <div className="hidden h-6 w-px shrink-0 bg-gray-300 xl:block" aria-hidden />

        <div className="min-w-0 flex-1 xl:min-w-[14rem]">
          <CompactDatePreset
            label="판매"
            preset={filters.soldDatePreset}
            month={filters.soldMonth}
            day={filters.soldDay}
            onPresetChange={(soldDatePreset) => onChange({ ...filters, soldDatePreset })}
            onMonthChange={(soldMonth) => onChange({ ...filters, soldMonth })}
            onDayChange={(soldDay) => onChange({ ...filters, soldDay })}
          />
        </div>

        <div className="min-w-0 flex-1 xl:min-w-[14rem]">
          <CompactDatePreset
            label="인계"
            preset={filters.handoverDatePreset}
            month={filters.handoverMonth}
            day={filters.handoverDay}
            onPresetChange={(handoverDatePreset) => onChange({ ...filters, handoverDatePreset })}
            onMonthChange={(handoverMonth) => onChange({ ...filters, handoverMonth })}
            onDayChange={(handoverDay) => onChange({ ...filters, handoverDay })}
          />
        </div>
      </div>
    </div>
  );
}
