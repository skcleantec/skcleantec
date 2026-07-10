import { useMemo, useState } from 'react';
import type { OrderFollowupDatePreset } from '../../api/orderFollowups';
import { ORDER_FOLLOWUP_STATUS_LABEL, type OrderFollowupStatus } from '../../constants/orderFollowupStatus';
import { YearMonthSelect, YmdSelect } from '../ui/DateQuerySelects';
import { ListPaginationBar } from '../ui/ListPaginationBar';
import type { InquiryListPageSize } from '../../utils/listPagination';
import type { FollowupBrandScope, FollowupListDateBasis, FollowupListFilterState } from './followupListQuery';

const STATUS_CHIPS = [
  { value: '' as const, label: '전체' },
  { value: 'REQUESTED' as const, label: ORDER_FOLLOWUP_STATUS_LABEL.REQUESTED },
  { value: 'ABSENT' as const, label: ORDER_FOLLOWUP_STATUS_LABEL.ABSENT },
  { value: 'ON_HOLD' as const, label: ORDER_FOLLOWUP_STATUS_LABEL.ON_HOLD },
];

function followupFilterSummary(filters: FollowupListFilterState): string {
  const parts: string[] = [];
  parts.push(filters.listDateBasis === 'preferredMoveIn' ? '희망일' : '등록일');
  if (filters.datePreset === 'today') parts.push('오늘');
  else if (filters.datePreset === 'all') parts.push('전체');
  else if (filters.datePreset === 'month') parts.push(`월별 ${filters.dateMonthKey}`);
  else if (filters.datePreset === 'day') parts.push(`일별 ${filters.dateDayKey}`);
  if (filters.brandScope === 'work') parts.push('작업 브랜드');
  if (filters.phoneLock) parts.push('CRM 연락처');
  if (filters.filterStatus) parts.push(ORDER_FOLLOWUP_STATUS_LABEL[filters.filterStatus]);
  if (filters.filterGoldDbOnly) parts.push('골드DB');
  if (filters.filterCustomerName.trim()) parts.push(`「${filters.filterCustomerName.trim()}」`);
  return parts.join(' · ');
}

export function FollowupListFilters({
  compact = false,
  filters,
  listDateBasis,
  onListDateBasisChange,
  datePreset,
  onDatePresetChange,
  dateMonthKey,
  onDateMonthKeyChange,
  dateDayKey,
  onDateDayKeyChange,
  filterStatus,
  onFilterStatusChange,
  filterCustomerName,
  onFilterCustomerNameChange,
  filterGoldDbOnly,
  onFilterGoldDbOnlyChange,
  brandScope,
  onBrandScopeChange,
  showBrandScope = false,
  phoneLock,
  onPhoneLockChange,
  crmPhoneAvailable = false,
  listPage,
  listPageSize,
  total,
  onPageChange,
  onPageSizeChange,
  defaultCollapsed = true,
}: {
  compact?: boolean;
  filters: FollowupListFilterState;
  listDateBasis: FollowupListDateBasis;
  onListDateBasisChange: (v: FollowupListDateBasis) => void;
  datePreset: OrderFollowupDatePreset;
  onDatePresetChange: (v: OrderFollowupDatePreset) => void;
  dateMonthKey: string;
  onDateMonthKeyChange: (v: string) => void;
  dateDayKey: string;
  onDateDayKeyChange: (v: string) => void;
  filterStatus: OrderFollowupStatus | '';
  onFilterStatusChange: (v: OrderFollowupStatus | '') => void;
  filterCustomerName: string;
  onFilterCustomerNameChange: (v: string) => void;
  filterGoldDbOnly: boolean;
  onFilterGoldDbOnlyChange: (v: boolean) => void;
  brandScope: FollowupBrandScope;
  onBrandScopeChange: (v: FollowupBrandScope) => void;
  showBrandScope?: boolean;
  phoneLock: boolean;
  onPhoneLockChange: (v: boolean) => void;
  crmPhoneAvailable?: boolean;
  listPage: number;
  listPageSize: InquiryListPageSize;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: InquiryListPageSize) => void;
  defaultCollapsed?: boolean;
}) {
  const [expanded, setExpanded] = useState(!defaultCollapsed);
  const summary = useMemo(() => followupFilterSummary(filters), [filters]);

  const segBtn = (active: boolean) =>
    `rounded-md px-2 py-0.5 text-[10px] font-semibold transition-all ${
      active ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
    }`;

  const chipBtn = (active: boolean) =>
    `rounded-full border px-2 py-0.5 text-[10px] font-semibold touch-manipulation transition-all ${
      active
        ? 'border-slate-800 bg-slate-900 text-white'
        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
    }`;

  return (
    <div className={`rounded-xl border border-slate-200/80 bg-slate-50/60 ${compact ? 'p-1.5' : 'p-3'}`}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700 hover:bg-slate-50"
          aria-expanded={expanded}
        >
          <span className="text-slate-400" aria-hidden>
            {expanded ? '▼' : '▶'}
          </span>
          필터
        </button>
        {!expanded ? (
          <span className="min-w-0 flex-1 truncate text-[10px] text-slate-600" title={summary}>
            {summary}
          </span>
        ) : null}
        <div className={expanded ? 'ml-auto' : ''}>
          <ListPaginationBar
            mode="summary"
            page={listPage}
            pageSize={listPageSize}
            total={total}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        </div>
      </div>

      {expanded ? (
        <div className="mt-1.5 space-y-1.5 border-t border-slate-200/60 pt-1.5">
          <div className="flex flex-wrap items-center gap-1 min-w-0">
            <div className="inline-flex shrink-0 rounded-lg border border-slate-200 overflow-hidden bg-white p-0.5">
              <button type="button" onClick={() => onListDateBasisChange('createdAt')} className={segBtn(listDateBasis === 'createdAt')}>
                등록일
              </button>
              <button type="button" onClick={() => onListDateBasisChange('preferredMoveIn')} className={segBtn(listDateBasis === 'preferredMoveIn')}>
                희망일
              </button>
            </div>
            <div className="inline-flex shrink-0 rounded-lg border border-slate-200 overflow-hidden bg-white p-0.5">
              {(['today', 'all', 'month', 'day'] as const).map((preset) => (
                <button
                  key={preset}
                  type="button"
                  disabled={phoneLock}
                  onClick={() => {
                    onDatePresetChange(preset);
                    if (preset === 'all') onFilterGoldDbOnlyChange(false);
                  }}
                  className={`${segBtn(datePreset === preset)} disabled:opacity-40`}
                >
                  {preset === 'today' ? '오늘' : preset === 'all' ? '전체' : preset === 'month' ? '월별' : '일별'}
                </button>
              ))}
            </div>
            {datePreset === 'month' ? (
              <YearMonthSelect value={dateMonthKey} onChange={onDateMonthKeyChange} idPrefix="crm-fu-month" className="items-center" />
            ) : null}
            {datePreset === 'day' ? (
              <YmdSelect value={dateDayKey} onChange={onDateDayKeyChange} idPrefix="crm-fu-day" className="items-center" />
            ) : null}
            {showBrandScope ? (
              <div className="inline-flex shrink-0 rounded-lg border border-slate-200 overflow-hidden bg-white p-0.5">
                <button type="button" onClick={() => onBrandScopeChange('all')} className={segBtn(brandScope === 'all')}>
                  업체 전체
                </button>
                <button type="button" onClick={() => onBrandScopeChange('work')} className={segBtn(brandScope === 'work')}>
                  작업 브랜드
                </button>
              </div>
            ) : null}
            {crmPhoneAvailable ? (
              <button
                type="button"
                onClick={() => onPhoneLockChange(!phoneLock)}
                className={`${chipBtn(phoneLock)} border-sky-200 ${
                  phoneLock ? 'bg-sky-700 text-white border-sky-700' : 'text-sky-800 hover:bg-sky-50'
                }`}
              >
                CRM 연락처만
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-1 min-w-0">
            <input
              type="text"
              value={filterCustomerName}
              onChange={(e) => onFilterCustomerNameChange(e.target.value)}
              placeholder="고객명 검색"
              className="min-w-[8rem] flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
            {filterCustomerName.trim() ? (
              <button
                type="button"
                onClick={() => onFilterCustomerNameChange('')}
                className="shrink-0 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[10px] text-slate-600 hover:bg-slate-50"
              >
                초기화
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onFilterGoldDbOnlyChange(!filterGoldDbOnly)}
              className={`${chipBtn(filterGoldDbOnly)} ${
                filterGoldDbOnly
                  ? 'border-amber-500 bg-amber-50 text-amber-800'
                  : 'border-amber-200 text-amber-700 hover:bg-amber-50'
              }`}
            >
              골드DB만
            </button>
            {STATUS_CHIPS.map((c) => (
              <button
                key={String(c.value)}
                type="button"
                onClick={() => {
                  const next = c.value === filterStatus && c.value !== '' ? '' : c.value;
                  onFilterStatusChange(next);
                  if (next === '') onFilterGoldDbOnlyChange(false);
                }}
                className={chipBtn((c.value === '' && filterStatus === '') || c.value === filterStatus)}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
