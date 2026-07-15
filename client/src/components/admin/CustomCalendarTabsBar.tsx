import type { UserCustomCalendarItem } from '../../api/userCustomCalendars';
import { customCalendarColorTokens } from '../../constants/customCalendarColors';
import {
  formatCompanyTabHint,
  formatPartnerTabHint,
  formatRegionTabHint,
} from '../../utils/customCalendarClassification';
import { EditAppIcon } from '../icons/EditAppIcon';

export type CustomCalendarTabsBarProps = {
  calendars: readonly UserCustomCalendarItem[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
  onClickAdd: () => void;
  /** false면 +추가 버튼 숨김 */
  showAddButton?: boolean;
  /** 전체 캘린더로 복귀하는 '전체' 칩을 함께 보여줄지 */
  showAllChip?: boolean;
  /** 줄 구분 라벨 (지역 / 업체 / 파트너) */
  rowLabel?: '지역' | '업체' | '파트너';
  addButtonTitle?: string;
  /** 활성 탭 수정 — 권한 있을 때만 전달 */
  onEditCalendar?: (cal: UserCustomCalendarItem) => void;
  externalCompanyNames?: ReadonlyMap<string, string>;
  partnerTenantNames?: ReadonlyMap<string, string>;
  className?: string;
};

/**
 * 스케줄 상단 범례 카드 — "+추가 / 탭 칩"만 표시. 상세는 설정 모달에서.
 */
export function CustomCalendarTabsBar({
  calendars,
  activeId,
  onSelect,
  onClickAdd,
  showAddButton = true,
  showAllChip = true,
  rowLabel,
  addButtonTitle,
  onEditCalendar,
  externalCompanyNames,
  partnerTenantNames,
  className = '',
}: CustomCalendarTabsBarProps) {
  const isCompanyRow = rowLabel === '업체';
  const isPartnerRow = rowLabel === '파트너';

  return (
    <div className={`flex w-full min-w-0 max-w-full items-center gap-1.5 pr-1 ${className}`}>
      {rowLabel ? (
        <span className="shrink-0 text-fluid-xs font-semibold text-slate-500 w-7 sm:w-8">
          {rowLabel}
        </span>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1 sm:flex-nowrap sm:overflow-x-auto sm:overscroll-x-contain sm:whitespace-nowrap sm:[scrollbar-width:none] sm:[&::-webkit-scrollbar]:hidden">
        {showAddButton ? (
          <button
            type="button"
            onClick={onClickAdd}
            className="shrink-0 inline-flex items-center justify-center rounded border border-gray-300 bg-white px-1 py-0 text-[9px] font-semibold leading-none text-gray-800 tabular-nums hover:bg-gray-50 min-[440px]:text-[10px] sm:px-1.5"
            title={addButtonTitle ?? (isPartnerRow ? '파트너 캘린더 추가' : isCompanyRow ? '업체 캘린더 추가' : '지역 캘린더 추가')}
          >
            +추가
          </button>
        ) : null}

        {showAllChip && calendars.length > 0 ? (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className={`shrink-0 inline-flex items-center justify-center rounded border px-1 py-0 text-[9px] font-semibold leading-none tabular-nums transition-colors min-[440px]:text-[10px] sm:px-1.5 ${
              activeId == null
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'
            }`}
            title={
              isPartnerRow ? '파트너 필터 해제' : isCompanyRow ? '업체 필터 해제' : rowLabel === '지역' ? '지역 필터 해제' : '전체 캘린더'
            }
          >
            전체
          </button>
        ) : null}

        {calendars.map((c) => {
          const t = customCalendarColorTokens(c.colorKey);
          const active = activeId === c.id;
          const hint = isPartnerRow
            ? formatPartnerTabHint(c.partnerTenantIds, partnerTenantNames ?? new Map())
            : isCompanyRow
              ? formatCompanyTabHint(c.externalCompanyIds, externalCompanyNames ?? new Map())
              : formatRegionTabHint(c.regions);
          return (
            <span key={c.id} className="inline-flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                onClick={() => onSelect(active ? null : c.id)}
                className={`inline-flex min-w-0 max-w-[min(11rem,calc(100vw-5rem))] items-center rounded border px-1 py-0 text-[9px] font-semibold leading-none transition-colors min-[440px]:max-w-[13rem] min-[440px]:text-[10px] sm:max-w-[15rem] sm:px-1.5 ${
                  active ? t.tabActive : t.tabIdle
                }`}
                title={`${c.name} — ${hint}`}
              >
                <span className="min-w-0 truncate">{c.name}</span>
              </button>
              {active && onEditCalendar ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditCalendar(c);
                  }}
                  className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
                  title="캘린더 설정"
                  aria-label={`${c.name} 설정`}
                >
                  <EditAppIcon className="h-3 w-3" alt="" />
                </button>
              ) : null}
            </span>
          );
        })}
      </div>
    </div>
  );
}
