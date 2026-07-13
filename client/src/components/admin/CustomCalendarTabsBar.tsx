import type { UserCustomCalendarItem } from '../../api/userCustomCalendars';
import { customCalendarColorTokens } from '../../constants/customCalendarColors';

export type CustomCalendarTabsBarProps = {
  calendars: readonly UserCustomCalendarItem[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
  onClickAdd: () => void;
  /** false면 +추가 버튼 숨김 */
  showAddButton?: boolean;
  /** 전체 캘린더로 복귀하는 '전체' 칩을 함께 보여줄지 */
  showAllChip?: boolean;
  /** 줄 구분 라벨 (지역 / 업체) */
  rowLabel?: '지역' | '업체';
  addButtonTitle?: string;
  className?: string;
};

/**
 * 스케줄 상단 범례 카드 맨 아래 영역에 놓이는 "+캘린더 추가 / 내 탭들" 바.
 * - 탭 클릭 → onSelect(id) (편집은 활성 캘린더 안내 줄의 수정 버튼에서)
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
  className = '',
}: CustomCalendarTabsBarProps) {
  return (
    <div
      className={`flex w-full min-w-0 max-w-full items-center gap-1.5 pr-1 ${className}`}
    >
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
        title={addButtonTitle ?? (rowLabel === '업체' ? '업체 캘린더 추가' : '지역 캘린더 추가')}
      >
        +추가
      </button>
      ) : null}

      {showAllChip && calendars.length > 0 && (
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`shrink-0 inline-flex items-center justify-center rounded border px-1 py-0 text-[9px] font-semibold leading-none tabular-nums transition-colors min-[440px]:text-[10px] sm:px-1.5 ${
            activeId == null
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'
          }`}
          title={rowLabel === '업체' ? '업체 필터 해제' : rowLabel === '지역' ? '지역 필터 해제' : '전체 캘린더'}
        >
          전체
        </button>
      )}

      {calendars.map((c) => {
        const t = customCalendarColorTokens(c.colorKey);
        const active = activeId === c.id;
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelect(active ? null : c.id)}
            className={`shrink-0 inline-flex min-w-0 max-w-[min(11rem,calc(100vw-5rem))] items-center rounded border px-1 py-0 text-[9px] font-semibold leading-none transition-colors min-[440px]:max-w-[13rem] min-[440px]:text-[10px] sm:max-w-[15rem] sm:px-1.5 ${
              active ? t.tabActive : t.tabIdle
            }`}
            title={`${c.name} (${[
              ...c.regions,
              ...(c.externalCompanyIds ?? []).map((id) => `타업체:${id}`),
            ].join(', ')})`}
          >
            <span className="min-w-0 truncate">{c.name}</span>
          </button>
        );
      })}
      </div>
    </div>
  );
}
