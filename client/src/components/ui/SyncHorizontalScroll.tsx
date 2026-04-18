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

function mainScrollClassNames(hasOverflow: boolean, showDock: boolean, contentClassName: string): string {
  const base = `w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain pb-1 ${contentClassName}`;
  if (!hasOverflow) return base;
  if (showDock) {
    return `${base} [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`;
  }
  return `${base} [scrollbar-width:thin] [&::-webkit-scrollbar]:h-2`;
}

type Props = {
  children: ReactNode;
  /** 바깥 래퍼 */
  className?: string;
  /** 가로 스크롤 영역에 추가할 클래스 (패딩·-mx 등) */
  contentClassName?: string;
};

/**
 * 표에 가로 넘침이 있으면 **뷰포트 하단 고정** 스크롤 막대(표와 scrollLeft 동기화) + ◀▶.
 * 표가 뷰에 보이는 동안만 막대 표시(세로 스크롤해도 화면 아래에 고정).
 * 막대가 켜진 동안에는 표 영역의 네이티브 가로 스크롤바를 숨겨 이중 UI를 막습니다.
 */
export function SyncHorizontalScroll({ children, className, contentClassName = '' }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const [spacerW, setSpacerW] = useState(0);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [tableInView, setTableInView] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const measure = useCallback(() => {
    const el = bottomRef.current;
    if (!el) return;
    const overflow = el.scrollWidth > el.clientWidth + 2;
    setSpacerW(el.scrollWidth);
    setHasOverflow(overflow);
  }, []);

  useLayoutEffect(() => {
    measure();
    const el = bottomRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  useEffect(() => {
    const el = bottomRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setTableInView(entry.isIntersecting),
      { threshold: 0, rootMargin: '0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const syncDockFromMain = useCallback((left: number) => {
    const d = dockRef.current;
    if (d && Math.abs(d.scrollLeft - left) > 0.5) d.scrollLeft = left;
  }, []);

  const onScrollBottom = (e: React.UIEvent<HTMLDivElement>) => {
    syncDockFromMain(e.currentTarget.scrollLeft);
  };

  const onScrollDock = (e: React.UIEvent<HTMLDivElement>) => {
    const b = bottomRef.current;
    if (b) b.scrollLeft = e.currentTarget.scrollLeft;
  };

  const scrollByDelta = (delta: number) => {
    const b = bottomRef.current;
    if (!b) return;
    b.scrollBy({ left: delta, behavior: 'smooth' });
  };

  const showDock = mounted && hasOverflow && tableInView;

  useLayoutEffect(() => {
    if (!showDock) return;
    const b = bottomRef.current;
    const d = dockRef.current;
    if (b && d) d.scrollLeft = b.scrollLeft;
  }, [showDock, spacerW]);

  return (
    <div className={`${className ?? ''} ${showDock ? 'pb-14' : ''}`}>
      {showDock &&
        createPortal(
          <div
            className="pointer-events-none fixed inset-x-0 bottom-0 z-[120]"
            style={{ paddingBottom: 'max(0.2rem, env(safe-area-inset-bottom, 0px))' }}
          >
            <div className="pointer-events-auto border-t border-gray-200 bg-white/95 px-2 py-1.5 shadow-[0_-6px_16px_rgba(0,0,0,0.08)] backdrop-blur-sm supports-[backdrop-filter]:bg-white/90">
              <div className="mx-auto flex max-w-6xl items-center gap-1">
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
                  onScroll={onScrollDock}
                  className="min-h-0 min-w-0 flex-1 overflow-x-auto overflow-y-hidden rounded-full bg-gray-200 py-1 [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1"
                  style={{ WebkitOverflowScrolling: 'touch' }}
                  aria-label="가로 스크롤"
                >
                  <div style={{ width: Math.max(spacerW, 1), height: 4 }} />
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
          document.body
        )}

      <div
        ref={bottomRef}
        onScroll={onScrollBottom}
        className={mainScrollClassNames(hasOverflow, showDock, contentClassName)}
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {children}
      </div>
    </div>
  );
}
