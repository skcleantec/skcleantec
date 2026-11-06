import { useLayoutEffect, useRef, useState, type RefObject } from 'react';
import {
  INQ_EDIT_EXPAND_EVENT,
  INQUIRY_EDIT_SECTION_ANCHOR_ORDER,
  INQUIRY_EDIT_SECTION_SHORT_LABELS,
  inquiryEditSecDomId,
} from '../../constants/inquiryEditSectionOrder';

/**
 * 접수 수정 — 섹션 이동 목록 (UI 규칙 v2)
 * - PC: 왼쪽 이름 목록 / 모바일·패널: 머리 아래 숫자 칩
 * - 번호 없는 칸(견적서·클레임 등)은 「·」
 * - 클릭 시 접힌 칸을 펼치고 제목이 본문 맨 위에 오도록 스크롤
 * - 클릭 직후 스크롤이 끝날 때까지 활성 표시를 고정(스크롤스파이가 덮어쓰지 않음)
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

function resolveSectionEl(scroller: HTMLElement, item: NavItem): HTMLElement | null {
  const id =
    item.num != null
      ? inquiryEditSecDomId(INQUIRY_EDIT_SECTION_ANCHOR_ORDER[item.num - 1]!)
      : item.domId;
  return scroller.querySelector(`#${CSS.escape(id)}`) as HTMLElement | null;
}

/** 접힌 details면 펼침 요청. 높이 변화 여부 반환 */
function requestExpandSection(el: HTMLElement): boolean {
  const details = el.querySelector(':scope > details') as HTMLDetailsElement | null;
  if (!details || details.open) return false;
  el.dispatchEvent(new Event(INQ_EDIT_EXPAND_EVENT));
  return true;
}

function waitFrames(n: number): Promise<void> {
  return new Promise((resolve) => {
    const step = (left: number) => {
      if (left <= 0) {
        resolve();
        return;
      }
      requestAnimationFrame(() => step(left - 1));
    };
    step(n);
  });
}

/** 본문 스크롤만 — 섹션 제목이 스크롤 영역 맨 위 */
async function jumpTo(scroller: HTMLElement, item: NavItem): Promise<void> {
  const el = resolveSectionEl(scroller, item);
  if (!el) return;
  const didExpand = requestExpandSection(el);
  if (didExpand) {
    // React open + 본문 마운트 후 높이 반영
    await waitFrames(3);
  }
  scroller.scrollTo({ top: Math.max(0, getScrollYForSection(el, scroller)), behavior: 'auto' });
}

export function InquiryEditSectionNav({ scrollContainerRef, wide = true }: Props) {
  const [items, setItems] = useState<NavItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  /** 클릭 직후 스크롤스파이 덮어쓰기 방지 */
  const pinRef = useRef<{ id: string; until: number } | null>(null);

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
      const pin = pinRef.current;
      if (pin && Date.now() < pin.until) {
        setActiveId(pin.id);
        return;
      }
      if (pin) pinRef.current = null;

      const sections = collectSections(sc);
      if (sections.length === 0) return;
      const st = sc.scrollTop;
      let current = sections[0]!.id;
      for (const s of sections) {
        if (getScrollYForSection(s, sc) <= st + 24) current = s.id;
      }
      // 맨 아래 여백이 있어도 스크롤 끝이면 마지막 칸 — 핀이 없을 때만
      if (sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 4) {
        current = sections[sections.length - 1]!.id;
      }
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

  if (items.length === 0) return null;

  /** 숫자 칸만(모바일 줄). 지금 보는 칸이 번호 없는 칸이면 바로 앞 번호 칸을 표시 */
  const numbered = items.filter((it) => it.num != null);
  let activeNumberedId: string | null = null;
  for (const it of items) {
    if (it.num != null) activeNumberedId = it.domId;
    if (it.domId === activeId) break;
  }

  const onPick = (item: NavItem) => {
    const sc = scrollContainerRef.current;
    if (!sc) return;
    pinRef.current = { id: item.domId, until: Date.now() + 1500 };
    setActiveId(item.domId);
    void jumpTo(sc, item).then(() => {
      // 스크롤·펼침 직후에도 잠시 고정
      pinRef.current = { id: item.domId, until: Date.now() + 500 };
      setActiveId(item.domId);
    });
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
      {/* 모바일(·패널): 예전 오른쪽 1~11 숫자 막대와 같은 숫자만, 가로 스크롤 없이 한 줄에 */}
      <div
        role="navigation"
        aria-label="접수 수정 칸 이동"
        className={`order-first grid shrink-0 gap-1 border-b border-slate-200 bg-white px-3 py-2 ${wide ? 'lg:hidden' : ''}`}
        style={{ gridTemplateColumns: `repeat(${Math.max(1, numbered.length)}, minmax(0, 1fr))` }}
      >
        {numbered.map((item) => {
          const on = item.domId === activeNumberedId;
          return (
            <button
              key={item.domId}
              type="button"
              onClick={() => onPick(item)}
              aria-label={`${item.num}. ${item.label}`}
              title={`${item.num}. ${item.label}`}
              aria-current={on ? 'true' : undefined}
              className={`inline-flex h-8 min-w-0 items-center justify-center rounded-lg text-fluid-xs font-bold tabular-nums touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 ${on ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 active:bg-slate-200'}`}
            >
              {item.num}
            </button>
          );
        })}
      </div>
    </>
  );
}
