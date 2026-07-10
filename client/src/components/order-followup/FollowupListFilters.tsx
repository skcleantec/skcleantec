import type { OrderFollowupDatePreset } from '../../api/orderFollowups';
import { ORDER_FOLLOWUP_STATUS_LABEL, type OrderFollowupStatus } from '../../constants/orderFollowupStatus';
import { YearMonthSelect, YmdSelect } from '../ui/DateQuerySelects';
import { ListPaginationBar } from '../ui/ListPaginationBar';
import type { InquiryListPageSize } from '../../utils/listPagination';
import type { FollowupBrandScope, FollowupListDateBasis } from './followupListQuery';

const STATUS_CHIPS = [
  { value: '' as const, label: '전체' },
  { value: 'REQUESTED' as const, label: ORDER_FOLLOWUP_STATUS_LABEL.REQUESTED },
  { value: 'ABSENT' as const, label: ORDER_FOLLOWUP_STATUS_LABEL.ABSENT },
  { value: 'ON_HOLD' as const, label: ORDER_FOLLOWUP_STATUS_LABEL.ON_HOLD },
];

export function FollowupListFilters({
  compact = false,
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
}: {
  compact?: boolean;
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
}) {
  const segBtn = (active: boolean) =>
    compact
      ? `rounded-lg px-2 py-1 text-[10px] font-semibold transition-all ${
          active ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
        }`
      : `rounded-lg px-3 py-1.5 text-fluid-xs font-semibold transition-all ${
          active ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
        }`;

  const chipBtn = (active: boolean) =>
    `rounded-full border px-2.5 py-0.5 font-semibold touch-manipulation transition-all ${
      compact ? 'text-[10px]' : 'text-[11px] sm:text-fluid-2xs'
    } ${
      active
        ? 'border-slate-800 bg-slate-900 text-white'
        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
    }`;

  return (
    <div
      className={`space-y-2 rounded-xl border border-slate-200/80 bg-slate-50/60 ${
        compact ? 'p-2' : 'p-3.5'
      }`}
    >
      <div className="flex flex-col gap-2 min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <div className="inline-flex shrink-0 rounded-xl border border-slate-200 overflow-hidden bg-white p-0.5 shadow-sm">
            <button
              type="button"
              onClick={() => onListDateBasisChange('createdAt')}
              className={segBtn(listDateBasis === 'createdAt')}
            >
              등록일
            </button>
            <button
              type="button"
              onClick={() => onListDateBasisChange('preferredMoveIn')}
              className={segBtn(listDateBasis === 'preferredMoveIn')}
            >
              희망일
            </button>
          </div>
          <div className="inline-flex shrink-0 flex-wrap rounded-xl border border-slate-200 overflow-hidden bg-white p-0.5 shadow-sm">
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
            <YearMonthSelect
              value={dateMonthKey}
              onChange={onDateMonthKeyChange}
              idPrefix={compact ? 'crm-fu-month' : 'followup-reg-month'}
              className="items-center"
            />
          ) : null}
          {datePreset === 'day' ? (
            <YmdSelect
              value={dateDayKey}
              onChange={onDateDayKeyChange}
              idPrefix={compact ? 'crm-fu-day' : 'followup-reg-day'}
              className="items-center"
            />
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {showBrandScope ? (
            <div className="inline-flex shrink-0 rounded-xl border border-slate-200 overflow-hidden bg-white p-0.5 shadow-sm">
              <button
                type="button"
                onClick={() => onBrandScopeChange('all')}
                className={segBtn(brandScope === 'all')}
              >
                업체 전체
              </button>
              <button
                type="button"
                onClick={() => onBrandScopeChange('work')}
                className={segBtn(brandScope === 'work')}
              >
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
          <ListPaginationBar
            mode="summary"
            page={listPage}
            pageSize={listPageSize}
            total={total}
            onPageChange={onPageChange}
            onPageSizeChange={onPageSizeChange}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <input
            type="text"
            value={filterCustomerName}
            onChange={(e) => onFilterCustomerNameChange(e.target.value)}
            placeholder="고객명 검색"
            className={`min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 ${
              compact ? 'text-[11px]' : 'text-fluid-2xs sm:text-fluid-xs'
            }`}
          />
          {filterCustomerName.trim() ? (
            <button
              type="button"
              onClick={() => onFilterCustomerNameChange('')}
              className="shrink-0 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-600 hover:bg-slate-50"
            >
              초기화
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onFilterGoldDbOnlyChange(!filterGoldDbOnly)}
            className={`${chipBtn(filterGoldDbOnly)} ${
              filterGoldDbOnly
                ? 'border-amber-500 bg-amber-50 text-amber-800 ring-1 ring-amber-200/50'
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
              className={chipBtn(
                (c.value === '' && filterStatus === '') || c.value === filterStatus,
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
