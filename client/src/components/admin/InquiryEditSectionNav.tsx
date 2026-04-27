import { useState, useLayoutEffect, useRef, useCallback, type RefObject, type PointerEvent as ReactPointerEvent } from 'react';

const STORAGE_KEY = 'sk_inquiry_edit_section_nav_y_ratio_v1';
const HOLD_MS = 420;
/** 약(위 화살+그립+아래 화살) */
const WIDGET_H = 96;

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

export function InquiryEditSectionNav({ scrollContainerRef, boundsRef }: Props) {
  const [topPx, setTopPx] = useState(80);
  const [dragging, setDragging] = useState(false);
  const topPxRef = useRef(80);
  const holdTimerRef = useRef<number | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const downPosRef = useRef({ x: 0, y: 0 });
  const dragStartClientYRef = useRef(0);
  const dragStartTopRef = useRef(0);
  const dragActiveRef = useRef(false);

  const clampTop = useCallback((raw: number) => {
    const bounds = boundsRef.current;
    if (!bounds) return raw;
    const h = bounds.clientHeight;
    const min = 8;
    const max = Math.max(min, h - WIDGET_H - 8);
    return Math.min(max, Math.max(min, raw));
  }, [boundsRef]);

  useLayoutEffect(() => {
    const bounds = boundsRef.current;
    if (!bounds) return;
    const h = bounds.clientHeight;
    if (h <= 0) return;
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
    const next = clampTop(ratio * h - WIDGET_H / 2);
    setTopPx(next);
    topPxRef.current = next;
  }, [boundsRef, clampTop]);

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
          const ratio = (y + WIDGET_H / 2) / Math.max(1, bounds.clientHeight);
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
    [boundsRef, clampTop]
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

  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 z-[50] w-0" aria-hidden={false}>
      <div
        className="pointer-events-auto absolute flex flex-col overflow-hidden rounded-l-xl border border-gray-200/80 bg-white/50 backdrop-blur-sm"
        style={{
          top: topPx,
          right: 0,
          width: 44,
        }}
      >
        <button
          type="button"
          onClick={() => onSectionNav('up')}
          className="flex h-10 w-full min-h-[40px] items-center justify-center border-b border-gray-100 text-gray-700 hover:bg-gray-50 active:bg-gray-100 touch-manipulation"
          aria-label="이전 섹션으로"
          title="이전 섹션"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 15l6-6 6 6" />
          </svg>
        </button>
        <div
          onPointerDown={onHandlePointerDown}
          className={`flex min-h-[16px] flex-1 cursor-grab select-none items-center justify-center border-b border-gray-100 py-0.5 text-gray-400 active:cursor-grabbing ${
            dragging ? 'cursor-grabbing bg-gray-100' : 'hover:bg-gray-50/80'
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
          className="flex h-10 w-full min-h-[40px] items-center justify-center text-gray-700 hover:bg-gray-50 active:bg-gray-100 touch-manipulation"
          aria-label="다음 섹션으로"
          title="다음 섹션"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
