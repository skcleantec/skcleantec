import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import {
  INQUIRY_EDIT_SECTION_ANCHOR_ORDER,
  INQUIRY_EDIT_SECTION_SHORT_LABELS,
  inquiryEditSecDomId,
} from '../../constants/inquiryEditSectionOrder';

/**
 * 접수 수정 — 섹션 이동 목록 (UI 규칙 v2)
 * - 예전 오른쪽 숫자(1~11) 막대와 같은 고정 번호로, 같은 방식(scrollIntoView block:start)으로 이동한다.
 * - 이름을 붙여 보여 주고, 지금 보고 있는 칸을 표시한다.
 * - PC(넓은 창): 창 왼쪽 목록 / 모바일·패널: 머리 아래 가로 칩 줄.
 * - 번호 없는 칸(발주서 추가 정보·내 추가 캘린더·견적서·클레임)은 「·」로 함께 보여 준다.
 */

type Props = {
  scrollContainerRef: RefObject<HTMLElement | null>;
  /** 예전 떠 있는 막대 위치 계산용 — 지금은 쓰지 않지만 호출부 호환을 위해 둔다 */
  boundsRef?: RefObject<HTMLElement | null>;
  /** true: lg 이상에서 왼쪽 목록, false: 항상 가로 칩 (패널 모드) */
  wide?: boolean;
};

type NavItem = { domId: string; num: number | null; label: string };

function collectSections(scroller: HTMLElement | null): HTMLElement[] {
  if (!scroller) return [];
  return Array.from(scroller.querySelectorAll<HTMLElement>('[data-inq-edit-section]'));
}

function getScrollYForSection(section: HTMLElement, scroller: HTMLElement): number {
  const cr = scroller.getBoundingClientRect();
  const sr = section.getBoundingClientRect();
  return scroller.scrollTop + (sr.top - cr.top);
}

function readItems(scroller: HTMLElement | null): NavItem[] {
  return collectSections(scroller).map((el) => {
    const anchor = el.id.replace(/^inq-edit-sec-/, '');
    const i = (INQUIRY_EDIT_SECTION_ANCHOR_ORDER as readonly string[]).indexOf(anchor);
    const label = i >= 0
      ? INQUIRY_EDIT_SECTION_SHORT_LABELS[i] ?? anchor
      : (el.dataset.inqEditTitle || anchor).trim();
    return { domId: el.id, num: i >= 0 ? i + 1 : null, label };
  });
}

/** 예전 숫자 버튼과 같은 이동: 고정 번호 → `#inq-edit-sec-{anchor}` 맨 위로 (본문 스크롤만) */
function jumpTo(scroller: HTMLElement, item: NavItem) {
  const id = item.num != null
    ? inquiryEditSecDomId(INQUIRY_EDIT_SECTION_ANCHOR_ORDER[item.num - 1]!)
    : item.domId;
  const el = scroller.querySelector(`#${CSS.escape(id)}`) as HTMLElement | null;
  if (!el) return;
  // scrollIntoView는 바깥 창(overflow-hidden)까지 밀어 올려 머리가 사라지고 아래가 비는 문제가 있어, 본문 스크롤만 움직인다.
  scroller.scrollTo({ top: Math.max(0, getScrollYForSection(el, scroller)), behavior: 'auto' });
}

export function InquiryEditSectionNav({ scrollContainerRef, wide = true }: Props) {
  const [items, setItems] = useState<NavItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const chipRowRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const sc = scrollContainerRef.current;
    if (!sc) return;
    let key = '';
    const sync = () => {
      const next = readItems(sc);
      const nextKey = next.map((n) => `${n.domId}:${n.label}`).join('|');
      if (nextKey !== key) {
        key = nextKey;
        setItems(next);
      }
    };
    const onScroll = () => {
      const sections = collectSections(sc);
      if (sections.length === 0) return;
      const st = sc.scrollTop;
      let current = sections[0]!.id;
      for (const s of sections) {
        if (getScrollYForSection(s, sc) <= st + 24) current = s.id;
      }
      if (sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 4) current = sections[sections.length - 1]!.id;
      setActiveId(current);
    };
    sync();
    onScroll();
    const mo = new MutationObserver(() => {
      sync();
      onScroll();
    });
    mo.observe(sc, { childList: true, subtree: true });
    sc.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      mo.disconnect();
      sc.removeEventListener('scroll', onScroll);
    };
  }, [scrollContainerRef]);

  /** 모바일 칩 줄: 지금 칸 칩이 보이도록 가로로만 맞춘다 */
  useLayoutEffect(() => {
    const row = chipRowRef.current;
    if (!row || !activeId) return;
    const chip = row.querySelector<HTMLElement>(`[data-nav-for="${CSS.escape(activeId)}"]`);
    if (!chip) return;
    const left = chip.offsetLeft - row.offsetLeft;
    if (left < row.scrollLeft || left + chip.offsetWidth > row.scrollLeft + row.clientWidth) {
      row.scrollLeft = Math.max(0, left - 12);
    }
  }, [activeId]);

  if (items.length === 0) return null;

  const onPick = (item: NavItem) => {
    const sc = scrollContainerRef.current;
    if (!sc) return;
    jumpTo(sc, item);
  };

  return (
    <>
      {wide ? (
        <nav
          aria-label="접수 수정 칸 이동"
          className="order-first hidden w-[200px] shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-slate-200 bg-white p-2 lg:flex"
        >
          {items.map((item) => {
            const on = item.domId === activeId;
            return (
              <button
                key={item.domId}
                type="button"
                onClick={() => onPick(item)}
                aria-current={on ? 'true' : undefined}
                className={`flex h-8 w-full min-w-0 items-center gap-2 rounded-lg px-2 text-left text-fluid-xs touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${on ? 'bg-[#eff4ff] font-bold text-slate-900' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                <span
                  className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[11px] font-bold tabular-nums ${on ? 'bg-[#2563eb] text-white' : 'bg-slate-100 text-slate-500'}`}
                  aria-hidden
                >
                  {item.num ?? '·'}
                </span>
                <span className="min-w-0 truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      ) : null}
      <div
        ref={chipRowRef}
        role="navigation"
        aria-label="접수 수정 칸 이동"
        className={`order-first flex shrink-0 gap-1.5 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 [scrollbar-width:none] ${wide ? 'lg:hidden' : ''}`}
      >
        {items.map((item) => {
          const on = item.domId === activeId;
          return (
            <button
              key={item.domId}
              type="button"
              data-nav-for={item.domId}
              onClick={() => onPick(item)}
              aria-current={on ? 'true' : undefined}
              className={`inline-flex h-[30px] shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 text-fluid-2xs font-semibold touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${on ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600'}`}
            >
              <span className={on ? 'text-slate-400' : 'text-slate-400'} aria-hidden>{item.num ?? '·'}</span>
              {item.label}
            </button>
          );
        })}
      </div>
    </>
  );
}
