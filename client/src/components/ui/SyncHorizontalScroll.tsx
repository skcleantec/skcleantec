import {
  useRef,
  useState,
  useLayoutEffect,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { ADMIN_SECTION_SIDE_NAV_LAYOUT_EVENT } from '../../utils/adminSectionSideNavLayout';

const SCROLL_STEP = 120;

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

const SCROLLBAR_VISIBLE =
  '[scrollbar-width:thin] [&::-webkit-scrollbar]:h-2.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 [&::-webkit-scrollbar-track]:bg-slate-100';

type Props = {
  children: ReactNode;
  /** 바깥 래퍼 */
  className?: string;
  /** 가로 스크롤 영역에 추가할 클래스 (패딩·-mx 등) */
  contentClassName?: string;
};

type DockRect = { left: number; width: number };

/**
 * 표 가로 넘침 시 **표 영역 하단 고정** 가로 스크롤바(표 scrollLeft 동기화) + ◀▶.
 * 바깥 레이아웃은 가로로 넘치지 않고, 표 영역만 내부 scrollLeft 로 이동합니다.
 */
export function SyncHorizontalScroll({ children, className, contentClassName = '' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef(false);
  const [spacerW, setSpacerW] = useState(0);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [tableInView, setTableInView] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [dockRect, setDockRect] = useState<DockRect>({ left: 0, width: 0 });

  useEffect(() => setMounted(true), []);

  const updateDockRect = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const r = container.getBoundingClientRect();
    setDockRect({ left: r.left, width: r.width });
  }, []);

  const measure = useCallback(() => {
    const main = mainRef.current;
    const container = containerRef.current;
    if (!main) return;
    const inner = main.querySelector('table') ?? main.firstElementChild;
    const contentW =
      inner instanceof HTMLElement ? inner.getBoundingClientRect().width : main.scrollWidth;
    const viewportW = main.clientWidth;
    const overflow = contentW > viewportW + 2;
    setSpacerW(Math.ceil(contentW));
    setHasOverflow(overflow);
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

  const syncScrollLeft = useCallback((left: number, source: 'main' | 'dock') => {
    if (syncingRef.current) return;
    syncingRef.current = true;
    if (source !== 'main' && mainRef.current) mainRef.current.scrollLeft = left;
    if (source !== 'dock' && dockRef.current) dockRef.current.scrollLeft = left;
    requestAnimationFrame(() => {
      syncingRef.current = false;
    });
  }, []);

  const scrollByDelta = (delta: number) => {
    const main = mainRef.current;
    if (!main) return;
    syncScrollLeft(main.scrollLeft + delta, 'main');
  };

  const showDock = mounted && hasOverflow && tableInView && dockRect.width > 0;

  useLayoutEffect(() => {
    if (!hasOverflow) return;
    const left = mainRef.current?.scrollLeft ?? 0;
    syncScrollLeft(left, 'main');
  }, [hasOverflow, spacerW, dockRect.width, syncScrollLeft]);

  return (
    <div
      ref={containerRef}
      className={`max-w-full min-w-0 overflow-x-hidden ${className ?? ''} ${showDock ? 'pb-14' : ''}`}
    >
      {showDock &&
        createPortal(
          <div
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
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 active:bg-gray-200"
                  aria-label="왼쪽"
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                </button>
                <div
                  ref={dockRef}
                  onScroll={(e) => syncScrollLeft(e.currentTarget.scrollLeft, 'dock')}
                  className={`min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-hidden rounded-full bg-gray-200 py-1.5 ${SCROLLBAR_VISIBLE}`}
                  style={{ WebkitOverflowScrolling: 'touch' }}
                  aria-label="표 가로 스크롤"
                >
                  <div style={{ width: Math.max(spacerW, 1), height: 6 }} aria-hidden />
                </div>
                <button
                  type="button"
                  onClick={() => scrollByDelta(SCROLL_STEP)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 active:bg-gray-200"
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
        onScroll={(e) => syncScrollLeft(e.currentTarget.scrollLeft, 'main')}
        className={`w-full max-w-full min-w-0 overflow-x-auto overscroll-x-contain ${
          hasOverflow ? '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden' : ''
        } ${contentClassName}`}
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {children}
      </div>
    </div>
  );
}
