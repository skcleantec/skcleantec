import type { UserCustomCalendarItem } from '../../api/userCustomCalendars';
import { customCalendarColorTokens } from '../../constants/customCalendarColors';

export type CustomCalendarTabsBarProps = {
  calendars: readonly UserCustomCalendarItem[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
  onClickAdd: () => void;
  /** ⋯ 버튼 클릭 시 호출 — 편집 모달이 바로 열리도록 부모에서 처리 */
  onEdit: (item: UserCustomCalendarItem) => void;
  /** 전체 캘린더로 복귀하는 '전체' 칩을 함께 보여줄지 */
  showAllChip?: boolean;
  className?: string;
};

/**
 * 스케줄 상단 범례 카드 맨 아래 영역에 놓이는 "+캘린더 추가 / 내 탭들" 바.
 * - 탭 클릭 → onSelect(id)
 * - 탭 옆 ⋯ 버튼 → 편집 모달(지역 추가/삭제·이름 수정·캘린더 삭제 모두 그 안에서)
 */
export function CustomCalendarTabsBar({
  calendars,
  activeId,
  onSelect,
  onClickAdd,
  onEdit,
  showAllChip = true,
  className = '',
}: CustomCalendarTabsBarProps) {
  return (
    <div
      className={`flex w-full min-w-0 max-w-full flex-wrap items-center gap-1.5 pr-1 sm:flex-nowrap sm:overflow-x-auto sm:overscroll-x-contain sm:whitespace-nowrap sm:[scrollbar-width:none] sm:[&::-webkit-scrollbar]:hidden ${className}`}
    >
      <button
        type="button"
        onClick={onClickAdd}
        className="shrink-0 inline-flex h-7 items-center gap-1 rounded-full border border-gray-300 bg-white px-2 py-0 text-[10px] font-medium text-gray-800 hover:bg-gray-50 shadow-sm min-[440px]:text-[11px] sm:h-8 sm:px-2.5 sm:text-fluid-xs"
        title="지역 필터 캘린더 추가"
      >
        <span aria-hidden className="text-xs leading-none min-[440px]:text-sm">+</span>
        <span className="inline max-[360px]:hidden">캘린더 추가</span>
      </button>

      {showAllChip && calendars.length > 0 && (
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`shrink-0 inline-flex h-7 items-center gap-1 rounded-full border px-2 py-0 text-[10px] font-medium transition-colors min-[440px]:text-[11px] sm:h-8 sm:px-2.5 sm:text-fluid-xs ${
            activeId == null
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
          title="전체 캘린더"
        >
          <span className="inline max-[360px]:hidden">전체</span>
          <span className="hidden max-[360px]:inline">●</span>
        </button>
      )}

      {calendars.map((c) => {
        const t = customCalendarColorTokens(c.colorKey);
        const active = activeId === c.id;
        return (
          <div key={c.id} className="shrink-0 relative inline-flex items-stretch">
            <button
              type="button"
              onClick={() => onSelect(active ? null : c.id)}
              className={`inline-flex h-7 max-w-[11.5rem] min-w-0 items-center gap-1 rounded-l-full border px-2 py-0 text-[10px] font-medium transition-colors min-[440px]:text-[11px] sm:h-8 sm:gap-1.5 sm:px-2.5 sm:text-fluid-xs ${
                active ? t.tabActive : t.tabIdle
              }`}
              title={`${c.name} (${[
                ...c.regions,
                ...(c.externalCompanyIds ?? []).map((id) => `타업체:${id}`),
              ].join(', ')})`}
            >
              <span className={`h-2 w-2 rounded-full ${active ? 'bg-white' : t.dot}`} />
              <span className="inline truncate max-w-[12rem] max-[360px]:hidden">{c.name}</span>
            </button>
            <button
              type="button"
              onClick={() => onEdit(c)}
              className={`inline-flex h-7 items-center justify-center rounded-r-full border border-l-0 px-1.5 py-0 text-[10px] min-[440px]:text-[11px] sm:h-8 sm:px-2 sm:text-fluid-xs ${
                active ? t.tabActive : t.tabIdle
              }`}
              aria-label={`${c.name} 설정`}
              title="이름·지역 수정 · 삭제"
            >
              <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor" aria-hidden>
                <circle cx="3" cy="8" r="1.4" />
                <circle cx="8" cy="8" r="1.4" />
                <circle cx="13" cy="8" r="1.4" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
