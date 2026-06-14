import {
  useRef,
  useState,
  useLayoutEffect,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

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

/**
 * 표 가로 넘침 시 **뷰포트 하단 고정** 가로 스크롤바(표 scrollLeft 동기화) + ◀▶.
 * 표 영역이 화면에 보이는 동안 화면 아래에 따라다닙니다.
 */
export function SyncHorizontalScroll({ children, className, contentClassName = '' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const syncingRef = useRef(false);
  const [spacerW, setSpacerW] = useState(0);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [tableInView, setTableInView] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const measure = useCallback(() => {
    const main = mainRef.current;
    const content = contentRef.current;
    if (!main || !content) return;
    const contentW = content.offsetWidth;
    const overflow = contentW > main.clientWidth + 2;
    setSpacerW(contentW);
    setHasOverflow(overflow);
  }, []);

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
    const content = contentRef.current;
    if (!main) return;
    const ro = new ResizeObserver(() => scheduleMeasure());
    ro.observe(main);
    if (content) ro.observe(content);
    window.addEventListener('resize', scheduleMeasure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', scheduleMeasure);
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

  const showDock = mounted && hasOverflow && tableInView;

  useLayoutEffect(() => {
    if (!hasOverflow) return;
    const left = mainRef.current?.scrollLeft ?? 0;
    syncScrollLeft(left, 'main');
  }, [hasOverflow, spacerW, syncScrollLeft]);

  return (
    <div ref={containerRef} className={`${className ?? ''} ${showDock ? 'pb-14' : ''}`}>
      {showDock &&
        createPortal(
          <div
            className="pointer-events-none fixed inset-x-0 bottom-0 z-[130]"
            style={{ paddingBottom: 'max(0.2rem, env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="pointer-events-auto border-t border-gray-200 bg-white/95 px-2 py-1.5 shadow-[0_-6px_16px_rgba(0,0,0,0.08)] backdrop-blur-sm supports-[backdrop-filter]:bg-white/90">
              <div className="flex w-full items-center gap-1 px-3 sm:px-4">
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
                  aria-label="가로 스크롤"
                >
                  <div style={{ width: Math.max(spacerW, 1), height: 6 }} />
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
        className={`w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain ${
          hasOverflow ? '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden' : ''
        } ${contentClassName}`}
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div ref={contentRef} className="inline-block min-w-full w-max align-top">
          {children}
        </div>
      </div>
    </div>
  );
}
