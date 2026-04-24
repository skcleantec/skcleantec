import { useEffect, useRef, useState } from 'react';
import type { UserCustomCalendarItem } from '../../api/userCustomCalendars';
import { customCalendarColorTokens } from '../../constants/customCalendarColors';

export type CustomCalendarTabsBarProps = {
  calendars: readonly UserCustomCalendarItem[];
  activeId: string | null;
  onSelect: (id: string | null) => void;
  onClickAdd: () => void;
  onEdit: (item: UserCustomCalendarItem) => void;
  onRequestDelete: (item: UserCustomCalendarItem) => void;
  /** 전체 캘린더로 복귀하는 '전체' 칩을 함께 보여줄지 */
  showAllChip?: boolean;
  className?: string;
};

/**
 * 스케줄 상단 범례 카드 맨 아래 영역에 놓이는 "+캘린더 추가 / 내 탭들" 바.
 * - 탭 클릭 → onSelect(id)
 * - 활성 탭 옆 ⋯ 메뉴로 이름 수정 / 삭제
 */
export function CustomCalendarTabsBar({
  calendars,
  activeId,
  onSelect,
  onClickAdd,
  onEdit,
  onRequestDelete,
  showAllChip = true,
  className = '',
}: CustomCalendarTabsBarProps) {
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpenId) return;
    const close = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (rootRef.current && target && !rootRef.current.contains(target)) {
        setMenuOpenId(null);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpenId(null);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('touchstart', close);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('touchstart', close);
      document.removeEventListener('keydown', onEsc);
    };
  }, [menuOpenId]);

  return (
    <div
      ref={rootRef}
      className={`flex items-center gap-1.5 min-w-0 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
    >
      <button
        type="button"
        onClick={onClickAdd}
        className="shrink-0 inline-flex items-center gap-1 rounded-full border border-gray-300 bg-white px-2.5 py-1 text-fluid-xs font-medium text-gray-800 hover:bg-gray-50 shadow-sm"
        title="지역 필터 캘린더 추가"
      >
        <span aria-hidden className="text-sm leading-none">+</span>
        <span>캘린더 추가</span>
      </button>

      {showAllChip && calendars.length > 0 && (
        <button
          type="button"
          onClick={() => onSelect(null)}
          className={`shrink-0 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-fluid-xs font-medium transition-colors ${
            activeId == null
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
          }`}
          title="전체 캘린더"
        >
          전체
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
              className={`inline-flex items-center gap-1.5 rounded-l-full border px-2.5 py-1 text-fluid-xs font-medium transition-colors ${
                active ? t.tabActive : t.tabIdle
              }`}
              title={`${c.name} (${c.regions.join(', ')})`}
            >
              <span className={`h-2 w-2 rounded-full ${active ? 'bg-white' : t.dot}`} />
              <span className="truncate max-w-[12rem]">{c.name}</span>
            </button>
            <button
              type="button"
              onClick={() => setMenuOpenId((prev) => (prev === c.id ? null : c.id))}
              className={`inline-flex items-center justify-center rounded-r-full border border-l-0 px-2 py-1 text-fluid-xs ${
                active ? t.tabActive : t.tabIdle
              }`}
              aria-label={`${c.name} 메뉴`}
              title="이름 수정·삭제"
            >
              <svg viewBox="0 0 16 16" className="w-3.5 h-3.5" fill="currentColor" aria-hidden>
                <circle cx="3" cy="8" r="1.4" />
                <circle cx="8" cy="8" r="1.4" />
                <circle cx="13" cy="8" r="1.4" />
              </svg>
            </button>
            {menuOpenId === c.id && (
              <div className="absolute top-full right-0 mt-1 w-40 rounded-md border border-gray-200 bg-white shadow-lg z-30 py-1">
                <button
                  type="button"
                  className="block w-full text-left px-3 py-1.5 text-fluid-xs text-gray-800 hover:bg-gray-50"
                  onClick={() => {
                    setMenuOpenId(null);
                    onEdit(c);
                  }}
                >
                  이름·지역 수정
                </button>
                <button
                  type="button"
                  className="block w-full text-left px-3 py-1.5 text-fluid-xs text-rose-700 hover:bg-rose-50"
                  onClick={() => {
                    setMenuOpenId(null);
                    onRequestDelete(c);
                  }}
                >
                  삭제
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
