import {
  useState,
  useLayoutEffect,
  useRef,
  useCallback,
  type RefObject,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  INQUIRY_EDIT_SECTION_ANCHOR_ORDER,
  INQUIRY_EDIT_SECTION_TITLE_HINTS,
  inquiryEditSecDomId,
} from '../../constants/inquiryEditSectionOrder';

const STORAGE_KEY = 'sk_inquiry_edit_section_nav_y_ratio_v1';
const HOLD_MS = 420;
/** ▲+그립+▼ 최소 높이(측정 전 폴백) */
const FAB_MIN_H = 96;

type Props = {
  scrollContainerRef: RefObject<HTMLElement | null>;
  boundsRef: RefObject<HTMLElement | null>;
};

function collectSections(scroller: HTMLElement | null): HTMLElement[] {
  if (!scroller) return [];
  return Array.from(scroller.querySelectorAll<HTMLElement>('[data-inq-edit-section]'));
}

function getScrollYForSection(section: HTMLElement, scroller: HTMLElement): number {
  const cr = scroller.getBoundingClientRect();
  const sr = section.getBoundingClientRect();
  return scroller.scrollTop + (sr.top - cr.top);
}

function scrollToPrev(scroller: HTMLElement, sections: HTMLElement[]) {
  if (sections.length === 0) return;
  const st = scroller.scrollTop;
  const margin = 6;
  for (let i = sections.length - 1; i >= 0; i--) {
    const s = sections[i]!;
    const y = getScrollYForSection(s, scroller);
    if (y < st - margin) {
      s.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
  }
  scroller.scrollTo({ top: 0, behavior: 'smooth' });
}

function scrollToNext(scroller: HTMLElement, sections: HTMLElement[]) {
  if (sections.length === 0) return;
  const st = scroller.scrollTop;
  const margin = 6;
  for (const s of sections) {
    const y = getScrollYForSection(s, scroller);
    if (y > st + margin) {
      s.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
  }
  scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' });
}

/** 고정 번호 N → `#inq-edit-sec-{anchor}` (없으면 무시) */
function scrollToCanonicalSection(sc: HTMLElement, oneBased: number) {
  const i = oneBased - 1;
  if (i < 0 || i >= INQUIRY_EDIT_SECTION_ANCHOR_ORDER.length) return;
  const anchor = INQUIRY_EDIT_SECTION_ANCHOR_ORDER[i]!;
  const el = sc.querySelector(`#${CSS.escape(inquiryEditSecDomId(anchor))}`) as HTMLElement | null;
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const SECTION_JUMP_COUNT = INQUIRY_EDIT_SECTION_ANCHOR_ORDER.length;

/** 우측 FAB — 본문을 덜 가리도록 낮은 불투명도 */
const navPanelShell =
  'rounded-l-xl border border-gray-200/35 bg-white/15 backdrop-blur-[2px] shadow-none';
const navBtnIdle = 'text-gray-600 hover:bg-white/25 active:bg-white/35';
const navBtnDivider = 'border-b border-gray-200/30';

export function InquiryEditSectionNav({ scrollContainerRef, boundsRef }: Props) {
  const [topPx, setTopPx] = useState(80);
  const [dragging, setDragging] = useState(false);
  const [stackHeight, setStackHeight] = useState(FAB_MIN_H);
  const topPxRef = useRef(80);
  const holdTimerRef = useRef<number | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const downPosRef = useRef({ x: 0, y: 0 });
  const dragStartClientYRef = useRef(0);
  const dragStartTopRef = useRef(0);
  const dragActiveRef = useRef(false);
  const stackRef = useRef<HTMLDivElement | null>(null);
  const appliedStorageRatio = useRef(false);

  const clampTop = useCallback(
    (raw: number) => {
      const bounds = boundsRef.current;
      if (!bounds) return raw;
      const h = bounds.clientHeight;
      const wh = Math.max(FAB_MIN_H, stackHeight);
      const min = 8;
      const max = Math.max(min, h - wh - 8);
      return Math.min(max, Math.max(min, raw));
    },
    [boundsRef, stackHeight]
  );

  useLayoutEffect(() => {
    const el = stackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setStackHeight(el.getBoundingClientRect().height);
    });
    ro.observe(el);
    setStackHeight(el.getBoundingClientRect().height);
    return () => ro.disconnect();
  }, []);

  /** 저장된 세로 위치는 스택 실측 이후 한 번만 적용 (섹션 수 변화로 비율 재적용 X) */
  useLayoutEffect(() => {
    if (appliedStorageRatio.current) return;
    const bounds = boundsRef.current;
    if (!bounds || stackHeight <= 0) return;
    let ratio = 0.38;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const n = parseFloat(raw);
        if (Number.isFinite(n) && n >= 0 && n <= 1) ratio = n;
      }
    } catch {
      /* ignore */
    }
    const h = bounds.clientHeight;
    if (h <= 0) return;
    const wh = Math.max(FAB_MIN_H, stackHeight);
    const min = 8;
    const max = Math.max(min, h - wh - 8);
    const next = Math.min(max, Math.max(min, ratio * h - wh / 2));
    setTopPx(next);
    topPxRef.current = next;
    appliedStorageRatio.current = true;
  }, [stackHeight]);

  /** 스택 높이·클램프 변화 시 현재 top만 경계 안으로 (튀는 현상 방지) */
  useLayoutEffect(() => {
    if (!appliedStorageRatio.current) return;
    setTopPx((prev) => {
      const next = clampTop(prev);
      topPxRef.current = next;
      return next;
    });
  }, [clampTop, stackHeight]);

  useLayoutEffect(() => {
    const onResize = () => {
      setTopPx((prev) => {
        const next = clampTop(prev);
        topPxRef.current = next;
        return next;
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [clampTop]);

  const endDragListeners = useRef<(() => void) | null>(null);

  const attachWindowDrag = useCallback(
    (startClientY: number) => {
      if (endDragListeners.current) {
        endDragListeners.current();
        endDragListeners.current = null;
      }
      dragStartClientYRef.current = startClientY;
      dragStartTopRef.current = topPxRef.current;
      const onMove = (evt: PointerEvent) => {
        if (pointerIdRef.current == null || evt.pointerId !== pointerIdRef.current) return;
        evt.preventDefault();
        const dy = evt.clientY - dragStartClientYRef.current;
        const next = clampTop(dragStartTopRef.current + dy);
        topPxRef.current = next;
        setTopPx(next);
      };
      const onUp = (evt: PointerEvent) => {
        if (pointerIdRef.current == null || evt.pointerId !== pointerIdRef.current) return;
        pointerIdRef.current = null;
        dragActiveRef.current = false;
        setDragging(false);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
        endDragListeners.current = null;
        const bounds = boundsRef.current;
        if (bounds) {
          const y = topPxRef.current;
          const wh = Math.max(FAB_MIN_H, stackRef.current?.getBoundingClientRect().height ?? stackHeight);
          const ratio = (y + wh / 2) / Math.max(1, bounds.clientHeight);
          const clamped = Math.min(1, Math.max(0, ratio));
          try {
            window.localStorage.setItem(STORAGE_KEY, String(clamped));
          } catch {
            /* ignore */
          }
        }
      };
      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
      endDragListeners.current = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
      };
    },
    [boundsRef, clampTop, stackHeight]
  );

  useLayoutEffect(
    () => () => {
      if (endDragListeners.current) endDragListeners.current();
      if (holdTimerRef.current != null) window.clearTimeout(holdTimerRef.current);
    },
    []
  );

  const lastPointerYRef = useRef(0);

  const onHandlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const pid = e.pointerId;
    pointerIdRef.current = pid;
    downPosRef.current = { x: e.clientX, y: e.clientY };
    lastPointerYRef.current = e.clientY;
    if (holdTimerRef.current != null) window.clearTimeout(holdTimerRef.current);

    const onEarlyMove = (evt: PointerEvent) => {
      if (pointerIdRef.current == null || evt.pointerId !== pid) return;
      lastPointerYRef.current = evt.clientY;
      const dx = Math.abs(evt.clientX - downPosRef.current.x);
      const dy = Math.abs(evt.clientY - downPosRef.current.y);
      if (dx + dy > 8 && holdTimerRef.current != null) {
        window.clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
    };
    const cleanupEarly = () => {
      window.removeEventListener('pointermove', onEarlyMove);
      window.removeEventListener('pointerup', onEarlyUp);
      window.removeEventListener('pointercancel', onEarlyUp);
    };
    const onEarlyUp = (evt: PointerEvent) => {
      if (pointerIdRef.current == null || evt.pointerId !== pid) return;
      if (holdTimerRef.current != null) {
        window.clearTimeout(holdTimerRef.current);
        holdTimerRef.current = null;
      }
      if (!dragActiveRef.current) {
        pointerIdRef.current = null;
      }
      cleanupEarly();
    };
    window.addEventListener('pointermove', onEarlyMove, { passive: true });
    window.addEventListener('pointerup', onEarlyUp);
    window.addEventListener('pointercancel', onEarlyUp);

    holdTimerRef.current = window.setTimeout(() => {
      holdTimerRef.current = null;
      if (pointerIdRef.current !== pid) return;
      cleanupEarly();
      dragActiveRef.current = true;
      setDragging(true);
      try {
        e.currentTarget.setPointerCapture(pid);
      } catch {
        /* ignore */
      }
      attachWindowDrag(lastPointerYRef.current);
    }, HOLD_MS);
  };

  const onSectionNav = (dir: 'up' | 'down') => {
    const sc = scrollContainerRef.current;
    if (!sc) return;
    const sections = collectSections(sc);
    if (dir === 'up') scrollToPrev(sc, sections);
    else scrollToNext(sc, sections);
  };

  const onJumpTo = (n: number) => {
    const sc = scrollContainerRef.current;
    if (!sc) return;
    scrollToCanonicalSection(sc, n);
  };

  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 z-[50] w-0" aria-hidden={false}>
      <div
        ref={stackRef}
        className="pointer-events-auto absolute flex w-[44px] flex-col gap-1"
        style={{
          top: topPx,
          right: 0,
        }}
      >
        <div className={`flex flex-col overflow-hidden ${navPanelShell}`}>
          <button
            type="button"
            onClick={() => onSectionNav('up')}
            className={`flex h-10 w-full min-h-[40px] items-center justify-center ${navBtnDivider} ${navBtnIdle} touch-manipulation`}
            aria-label="이전 섹션으로"
            title="이전 섹션"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 15l6-6 6 6" />
            </svg>
          </button>
          <div
            onPointerDown={onHandlePointerDown}
            className={`flex min-h-[16px] flex-1 cursor-grab select-none items-center justify-center ${navBtnDivider} py-0.5 text-gray-400 active:cursor-grabbing ${
              dragging ? 'cursor-grabbing bg-white/30' : 'hover:bg-white/20'
            }`}
            style={{ touchAction: 'none' }}
            title="길게 눌러 세로 위치만 이동"
            role="separator"
            aria-label="길게 눌러 위젯 위치를 세로로 이동"
          >
            <span className="text-[10px] font-bold leading-none tracking-tighter text-gray-400" aria-hidden>
              ⋮
              <br />
              ⋮
            </span>
          </div>
          <button
            type="button"
            onClick={() => onSectionNav('down')}
            className={`flex h-10 w-full min-h-[40px] items-center justify-center ${navBtnIdle} touch-manipulation`}
            aria-label="다음 섹션으로"
            title="다음 섹션"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
            </svg>
          </button>
        </div>

        <div
          className={`flex flex-col gap-0.5 py-1 pl-0.5 ${navPanelShell}`}
          role="group"
          aria-label="섹션 고정 번호로 이동 (1~9번, 7~9는 발주서·현장·이력)"
        >
          {Array.from({ length: SECTION_JUMP_COUNT }, (_, idx) => idx + 1).map((num) => {
            const hint = INQUIRY_EDIT_SECTION_TITLE_HINTS[num - 1] ?? '';
            return (
              <button
                key={num}
                type="button"
                onClick={() => onJumpTo(num)}
                className="flex h-7 w-full min-h-0 items-center justify-center rounded-md text-[11px] font-semibold tabular-nums text-gray-700 hover:bg-white/25 active:bg-white/35 sm:h-8 sm:text-fluid-2xs touch-manipulation"
                title={hint ? `${num}. ${hint}` : `${num}번 섹션`}
                aria-label={hint ? `${num}번, ${hint}` : `${num}번 섹션으로 이동`}
              >
                {num}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
