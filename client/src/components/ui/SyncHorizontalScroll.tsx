import {
  useRef,
  useState,
  useLayoutEffect,
  useEffect,
  useCallback,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { ADMIN_SECTION_SIDE_NAV_LAYOUT_EVENT } from '../../utils/adminSectionSideNavLayout';

const SCROLL_STEP = 120;
const MIN_THUMB_PX = 40;
/** 고정 가로 막대 위로 본문이 항상 남도록 더 띄우는 간격 */
const DOCK_CONTENT_GAP_PX = 28;

function pageScrollParent(start: HTMLElement | null): HTMLElement | null {
  const main = start?.closest('main.staff-app-surface');
  if (main instanceof HTMLElement) return main;
  let el = start?.parentElement ?? null;
  while (el) {
    const style = getComputedStyle(el);
    const scrolls =
      (style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1;
    if (scrolls) return el;
    el = el.parentElement;
  }
  return null;
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

type Props = {
  children: ReactNode;
  /** 바깥 래퍼 */
  className?: string;
  /** 가로 스크롤 영역에 추가할 클래스 (패딩·-mx 등) */
  contentClassName?: string;
};

type DockRect = { left: number; width: number };

/**
 * 표 가로 넘침 시 **하단 고정 커스텀 스크롤바 1개**(◀▶ 포함)만 표시.
 * 표 본문은 overflow-x:hidden — 네이티브 가로 스크롤바 없음.
 */
export function SyncHorizontalScroll({ children, className, contentClassName = '' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbDragRef = useRef<{ startX: number; startScroll: number } | null>(null);
  const [spacerW, setSpacerW] = useState(0);
  const [viewportW, setViewportW] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [tableInView, setTableInView] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dockRect, setDockRect] = useState<DockRect>({ left: 0, width: 0 });

  useEffect(() => setMounted(true), []);

  const maxScrollLeft = Math.max(0, spacerW - viewportW);

  const updateDockRect = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const r = container.getBoundingClientRect();
    setDockRect({ left: r.left, width: r.width });
  }, []);

  const measure = useCallback(() => {
    const main = mainRef.current;
    if (!main) return;
    const inner = main.querySelector('table') ?? main.firstElementChild;
    const contentW =
      inner instanceof HTMLElement ? inner.getBoundingClientRect().width : main.scrollWidth;
    const vpW = main.clientWidth;
    const overflow = contentW > vpW + 2;
    setSpacerW(Math.ceil(contentW));
    setViewportW(vpW);
    setHasOverflow(overflow);
    setScrollLeft(main.scrollLeft);
    updateDockRect();
  }, [updateDockRect]);

  const scheduleMeasure = useCallback(() => {
    measure();
    requestAnimationFrame(() => {
      measure();
      requestAnimationFrame(measure);
    });
  }, [measure]);

  useLayoutEffect(() => {
    scheduleMeasure();
    const main = mainRef.current;
    const container = containerRef.current;
    if (!main) return;
    const ro = new ResizeObserver(() => scheduleMeasure());
    ro.observe(main);
    if (container) ro.observe(container);
    const inner = main.querySelector('table') ?? main.firstElementChild;
    if (inner instanceof Element) ro.observe(inner);
    window.addEventListener('resize', scheduleMeasure);
    window.addEventListener(ADMIN_SECTION_SIDE_NAV_LAYOUT_EVENT, scheduleMeasure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', scheduleMeasure);
      window.removeEventListener(ADMIN_SECTION_SIDE_NAV_LAYOUT_EVENT, scheduleMeasure);
    };
  }, [scheduleMeasure, children]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setTableInView(entry.isIntersecting),
      { threshold: 0, rootMargin: '0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [children]);

  const applyScrollLeft = useCallback(
    (left: number) => {
      const main = mainRef.current;
      if (!main) return;
      const clamped = Math.max(0, Math.min(left, maxScrollLeft));
      if (main.scrollLeft !== clamped) main.scrollLeft = clamped;
      setScrollLeft(clamped);
    },
    [maxScrollLeft],
  );

  const scrollByDelta = useCallback(
    (delta: number) => {
      applyScrollLeft(scrollLeft + delta);
    },
    [applyScrollLeft, scrollLeft],
  );

  useEffect(() => {
    const main = mainRef.current;
    if (!main || !hasOverflow) return;

    const onWheel = (e: WheelEvent) => {
      const delta =
        Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.shiftKey ? e.deltaY : 0;
      if (delta === 0 || maxScrollLeft <= 0) return;
      e.preventDefault();
      applyScrollLeft(main.scrollLeft + delta);
    };

    main.addEventListener('wheel', onWheel, { passive: false });
    return () => main.removeEventListener('wheel', onWheel);
  }, [hasOverflow, maxScrollLeft, applyScrollLeft]);

  useLayoutEffect(() => {
    if (!hasOverflow) return;
    applyScrollLeft(mainRef.current?.scrollLeft ?? 0);
  }, [hasOverflow, spacerW, viewportW, applyScrollLeft]);

  const showDock = mounted && hasOverflow && tableInView && dockRect.width > 0;

  useLayoutEffect(() => {
    if (!showDock) return;
    const scrollEl = pageScrollParent(containerRef.current);
    if (!scrollEl) return;
    const count = Number(scrollEl.dataset.syncScrollDock || '0') + 1;
    scrollEl.dataset.syncScrollDock = String(count);
    const apply = () => {
      const dock = scrollEl.ownerDocument.querySelector('[data-sync-h-scroll-dock]');
      const height = dock instanceof HTMLElement ? dock.getBoundingClientRect().height : 56;
      scrollEl.style.marginBottom = `${Math.ceil(height + DOCK_CONTENT_GAP_PX)}px`;
    };
    apply();
    const frame = requestAnimationFrame(apply);
    return () => {
      cancelAnimationFrame(frame);
      const next = Number(scrollEl.dataset.syncScrollDock || '1') - 1;
      if (next <= 0) {
        delete scrollEl.dataset.syncScrollDock;
        scrollEl.style.marginBottom = '';
      } else {
        scrollEl.dataset.syncScrollDock = String(next);
      }
    };
  }, [showDock]);

  const trackInnerW = Math.max(0, dockRect.width - 72);
  const thumbW =
    maxScrollLeft <= 0 || trackInnerW <= 0
      ? trackInnerW
      : Math.max(MIN_THUMB_PX, Math.round((viewportW / spacerW) * trackInnerW));
  const thumbTravel = Math.max(0, trackInnerW - thumbW);
  const thumbLeft =
    maxScrollLeft <= 0 ? 0 : Math.round((scrollLeft / maxScrollLeft) * thumbTravel);

  const scrollFromTrackX = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track || maxScrollLeft <= 0) return;
      const rect = track.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left - thumbW / 2) / thumbTravel));
      applyScrollLeft(ratio * maxScrollLeft);
    },
    [applyScrollLeft, maxScrollLeft, thumbTravel, thumbW],
  );

  const onTrackPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (maxScrollLeft <= 0) return;
    scrollFromTrackX(e.clientX);
  };

  const onThumbPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (maxScrollLeft <= 0) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    thumbDragRef.current = { startX: e.clientX, startScroll: scrollLeft };
  };

  const onThumbPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = thumbDragRef.current;
    const track = trackRef.current;
    if (!drag || !track || maxScrollLeft <= 0 || thumbTravel <= 0) return;
    const deltaX = e.clientX - drag.startX;
    const scrollDelta = (deltaX / thumbTravel) * maxScrollLeft;
    applyScrollLeft(drag.startScroll + scrollDelta);
  };

  const onThumbPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    thumbDragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  return (
    <div
      ref={containerRef}
      className={`max-w-full min-w-0 overflow-x-hidden ${className ?? ''}`}
    >
      {showDock &&
        createPortal(
          <div
            data-sync-h-scroll-dock=""
            className="pointer-events-none fixed bottom-0 z-[130]"
            style={{
              left: dockRect.left,
              width: dockRect.width,
              paddingBottom: 'max(0.2rem, env(safe-area-inset-bottom, 0px))',
            }}
          >
            <div className="pointer-events-auto border-t border-gray-200 bg-white/95 px-2 py-1.5 shadow-[0_-6px_16px_rgba(0,0,0,0.08)] backdrop-blur-sm supports-[backdrop-filter]:bg-white/90">
              <div className="flex w-full max-w-full min-w-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => scrollByDelta(-SCROLL_STEP)}
                  disabled={scrollLeft <= 0}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-40"
                  aria-label="왼쪽"
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                </button>
                <div
                  ref={trackRef}
                  role="scrollbar"
                  aria-orientation="horizontal"
                  aria-valuemin={0}
                  aria-valuemax={maxScrollLeft}
                  aria-valuenow={scrollLeft}
                  aria-label="표 가로 스크롤"
                  className="relative h-2.5 min-w-0 flex-1 cursor-pointer rounded-full bg-slate-200"
                  onPointerDown={onTrackPointerDown}
                >
                  <div
                    role="presentation"
                    className="absolute top-0 h-full rounded-full bg-slate-500 hover:bg-slate-600 active:bg-slate-700 touch-none"
                    style={{ width: thumbW, transform: `translateX(${thumbLeft}px)` }}
                    onPointerDown={onThumbPointerDown}
                    onPointerMove={onThumbPointerMove}
                    onPointerUp={onThumbPointerUp}
                    onPointerCancel={onThumbPointerUp}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => scrollByDelta(SCROLL_STEP)}
                  disabled={scrollLeft >= maxScrollLeft - 1}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 active:bg-gray-200 disabled:opacity-40"
                  aria-label="오른쪽"
                >
                  <ChevronRightIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      <div
        ref={mainRef}
        onScroll={(e) => {
          if (!hasOverflow) return;
          setScrollLeft(e.currentTarget.scrollLeft);
        }}
        className={`w-full max-w-full min-w-0 overflow-y-visible overscroll-x-contain ${
          hasOverflow ? 'sync-horizontal-scroll-main' : 'overflow-x-hidden'
        } ${contentClassName}`}
        style={{
          WebkitOverflowScrolling: 'touch',
          ...(hasOverflow
            ? ({ scrollbarWidth: 'none', msOverflowStyle: 'none' } as const)
            : undefined),
        }}
      >
        {children}
      </div>
    </div>
  );
}
