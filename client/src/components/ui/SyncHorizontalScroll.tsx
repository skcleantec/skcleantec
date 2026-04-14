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

type DockUntil = 'md' | 'lg' | 'xl';

function dockVisibilityClasses(dockUntil: DockUntil): { dockHidden: string; scrollbar: string } {
  switch (dockUntil) {
    case 'lg':
      return {
        dockHidden: 'lg:hidden',
        scrollbar:
          'max-lg:[scrollbar-width:none] max-lg:[&::-webkit-scrollbar]:hidden lg:[scrollbar-width:thin]',
      };
    case 'xl':
      return {
        dockHidden: 'xl:hidden',
        scrollbar:
          'max-xl:[scrollbar-width:none] max-xl:[&::-webkit-scrollbar]:hidden xl:[scrollbar-width:thin]',
      };
    case 'md':
    default:
      return {
        dockHidden: 'md:hidden',
        scrollbar:
          'max-md:[scrollbar-width:none] max-md:[&::-webkit-scrollbar]:hidden md:[scrollbar-width:thin]',
      };
  }
}

function dockReserveSpaceClass(dockUntil: DockUntil): string {
  switch (dockUntil) {
    case 'lg':
      return 'pb-14 lg:pb-0';
    case 'xl':
      return 'pb-14 xl:pb-0';
    case 'md':
    default:
      return 'pb-14 md:pb-0';
  }
}

type Props = {
  children: ReactNode;
  /** 바깥 래퍼 */
  className?: string;
  /** 가로 스크롤 영역에 추가할 클래스 (패딩·-mx 등) */
  contentClassName?: string;
  /**
   * 이 너비 **미만**에서만 하단 고정 스크롤 막대(◀▶) 표시. 그 이상은 표 안쪽 얇은 스크롤바.
   * @default 'md'
   */
  dockUntil?: DockUntil;
};

/**
 * 좁은 뷰포트: 표에 가로 넘침이 있으면 **뷰포트 하단 고정** 스크롤 바(표와 scrollLeft 동기화) + ◀▶.
 * 표가 보이는 동안만 하단 바 표시(세로 스크롤 시 따라다님). 넓은 화면은 표 아래 일반 스크롤바.
 */
export function SyncHorizontalScroll({
  children,
  className,
  contentClassName = '',
  dockUntil = 'md',
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const [spacerW, setSpacerW] = useState(0);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [tableInView, setTableInView] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { dockHidden, scrollbar } = dockVisibilityClasses(dockUntil);
  const dockReserveClass = dockReserveSpaceClass(dockUntil);

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
    <div className={`${className ?? ''} ${showDock ? dockReserveClass : ''}`}>
      {showDock &&
        createPortal(
          <div
            className={`pointer-events-none fixed inset-x-0 bottom-0 z-[105] ${dockHidden}`}
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
        className={`w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain pb-1 ${scrollbar} ${contentClassName}`}
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {children}
      </div>
    </div>
  );
}
