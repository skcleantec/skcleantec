import type { ReactNode } from 'react';
import type { UserCustomCalendarItem } from '../../api/userCustomCalendars';
import { customCalendarColorTokens } from '../../constants/customCalendarColors';
import {
  formatCompanyTabHint,
  formatPartnerTabHint,
  formatRegionTabHint,
} from '../../utils/customCalendarClassification';
import { EditAppIcon } from '../icons/EditAppIcon';

export type CustomCalendarRowLabel = '지역' | '업체' | '파트너';

const ROW_KIND_META: Record<
  CustomCalendarRowLabel,
  { short: string; title: string; btn: string; btnActive: string; icon: ReactNode }
> = {
  지역: {
    short: '지역',
    title: '지역 필터 — 클릭 시 전체',
    btn: 'border-emerald-300 bg-gradient-to-br from-emerald-400 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-700',
    btnActive: 'ring-1 ring-white/90',
    icon: (
      <svg className="h-2.5 w-2.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
        <path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
    ),
  },
  업체: {
    short: '업체',
    title: '업체 필터 — 클릭 시 전체',
    btn: 'border-amber-300 bg-gradient-to-br from-amber-400 to-orange-600 text-white hover:from-amber-500 hover:to-orange-700',
    btnActive: 'ring-1 ring-white/90',
    icon: (
      <svg className="h-2.5 w-2.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
        <path d="M4 20V9l8-4 8 4v11" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9 20v-6h6v6M9 12h6" strokeLinecap="round" />
      </svg>
    ),
  },
  파트너: {
    short: '파트너',
    title: '파트너 필터 — 클릭 시 전체',
    btn: 'border-violet-300 bg-gradient-to-br from-violet-500 to-indigo-600 text-white hover:from-violet-600 hover:to-indigo-700',
    btnActive: 'ring-1 ring-white/90',
    icon: (
      <svg className="h-2.5 w-2.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
        <path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3zM8 11c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3z" strokeLinecap="round" />
        <path d="M2 20c0-2.8 2.7-5 6-5M22 20c0-2.8-2.7-5-6-5M12 20c0-2.2-1.8-4-4-4" strokeLinecap="round" />
      </svg>
    ),
  },
};

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
  rowLabel?: CustomCalendarRowLabel;
  addButtonTitle?: string;
  /** 활성 탭 수정 — 권한 있을 때만 전달 */
  onEditCalendar?: (cal: UserCustomCalendarItem) => void;
  externalCompanyNames?: ReadonlyMap<string, string>;
  partnerTenantNames?: ReadonlyMap<string, string>;
  className?: string;
  /** 스케줄 PC — 한 줄 가로 스크롤 (줄바꿈 없음) */
  singleLine?: boolean;
  /** 스케줄 PC 왼쪽 세로 박스 — 줄바꿈·세로 배치 */
  sidebar?: boolean;
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
  singleLine = false,
  sidebar = false,
}: CustomCalendarTabsBarProps) {
  const isCompanyRow = rowLabel === '업체';
  const isPartnerRow = rowLabel === '파트너';
  const rowMeta = rowLabel ? ROW_KIND_META[rowLabel] : null;
  const chipsWrapClass = sidebar
    ? 'flex min-w-0 w-full flex-wrap items-center gap-1'
    : singleLine
      ? 'flex min-w-0 flex-nowrap items-center gap-1 overflow-x-auto overscroll-x-contain whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'
      : 'flex min-w-0 flex-1 flex-wrap items-center gap-1 sm:flex-nowrap sm:overflow-x-auto sm:overscroll-x-contain sm:whitespace-nowrap sm:[scrollbar-width:none] sm:[&::-webkit-scrollbar]:hidden';

  return (
    <div
      className={`min-w-0 max-w-full ${
        sidebar
          ? 'flex w-full flex-col items-stretch gap-1'
          : `flex items-center gap-1.5 pr-1 ${singleLine ? 'shrink-0 flex-nowrap' : 'w-full'}`
      } ${className}`}
    >
      {rowMeta ? (
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`inline-flex items-center justify-center gap-0.5 rounded border px-1 py-0 text-[9px] font-semibold leading-none tabular-nums touch-manipulation min-[440px]:text-[10px] sm:px-1.5 ${rowMeta.btn} ${
            activeId != null ? rowMeta.btnActive : ''
          } ${sidebar ? 'w-full min-h-[26px] py-1' : 'shrink-0'}`}
          title={rowMeta.title}
        >
          {rowMeta.icon}
          <span className="whitespace-nowrap">{rowMeta.short}</span>
        </button>
      ) : null}
      <div className={chipsWrapClass}>
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
