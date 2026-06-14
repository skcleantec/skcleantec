import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
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
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

type DarkHeaderNavScrollProps = {
  children: ReactNode;
  'aria-label': string;
  className?: string;
  /** 메뉴·배지 등 변경 시 스크롤 힌트 재계산 */
  hintKey?: string | number;
};

/** theme-dark-header GNB — 가로 스크롤 + 좌우 쉐브론 (AdminLayout과 동일 톤) */
export function DarkHeaderNavScroll({
  children,
  'aria-label': ariaLabel,
  className = '',
  hintKey,
}: DarkHeaderNavScrollProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [moreLeft, setMoreLeft] = useState(false);
  const [moreRight, setMoreRight] = useState(false);

  const updateHints = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const scrollWidth = Math.ceil(el.scrollWidth);
    const clientWidth = Math.floor(el.clientWidth);
    const scrollLeft = Math.round(el.scrollLeft);
    const maxScroll = Math.max(0, scrollWidth - clientWidth);
    const hasOverflow = scrollWidth > clientWidth + 1;
    const atStart = scrollLeft <= 2;
    const atEnd = maxScroll <= 2 || scrollLeft >= maxScroll - 2;
    setMoreLeft(hasOverflow && !atStart);
    setMoreRight(hasOverflow && !atEnd);
  }, []);

  useEffect(() => {
    queueMicrotask(() => updateHints());
  }, [hintKey, updateHints]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const run = () => updateHints();
    const ro = new ResizeObserver(run);
    ro.observe(el);
    window.addEventListener('resize', run);
    void document.fonts?.ready?.then(run);
    const t1 = window.setTimeout(run, 100);
    const t2 = window.setTimeout(run, 450);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', run);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [updateHints, hintKey]);

  const scrollStep = () => {
    const el = scrollRef.current;
    if (!el) return 140;
    return Math.min(160, Math.max(80, Math.round(el.clientWidth * 0.45)));
  };

  const scrollLeft = () => {
    scrollRef.current?.scrollBy({ left: -scrollStep(), behavior: 'smooth' });
  };

  const scrollRight = () => {
    scrollRef.current?.scrollBy({ left: scrollStep(), behavior: 'smooth' });
  };

  return (
    <div className={`relative min-w-0 ${className}`} data-team-mobile-nav>
      <div
        ref={scrollRef}
        role="navigation"
        aria-label={ariaLabel}
        onScroll={updateHints}
        className="flex min-w-0 flex-nowrap items-center gap-1 overflow-x-auto overscroll-x-contain pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {children}
      </div>
      {moreLeft ? (
        <div className="pointer-events-none absolute inset-y-0 left-0 z-20 flex items-center justify-start">
          <div
            className="pointer-events-none absolute inset-y-0 left-0 w-14 bg-gradient-to-r from-slate-900 via-slate-900/90 to-transparent"
            aria-hidden
          />
          <button
            type="button"
            data-admin-nav-scroll-btn
            onClick={scrollLeft}
            className="pointer-events-auto relative ml-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/30 bg-slate-700/95 text-white shadow-md shadow-black/25 transition-all hover:bg-slate-600 hover:border-white/40 active:scale-95"
            aria-label="메뉴가 왼쪽으로 더 있습니다. 탭하면 스크롤됩니다."
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
        </div>
      ) : null}
      {moreRight ? (
        <div className="pointer-events-none absolute inset-y-0 right-0 z-20 flex items-center justify-end">
          <div
            className="pointer-events-none absolute inset-y-0 right-0 w-14 bg-gradient-to-l from-slate-900 via-slate-900/90 to-transparent"
            aria-hidden
          />
          <button
            type="button"
            data-admin-nav-scroll-btn
            onClick={scrollRight}
            className="pointer-events-auto relative mr-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/30 bg-slate-700/95 text-white shadow-md shadow-black/25 transition-all hover:bg-slate-600 hover:border-white/40 active:scale-95"
            aria-label="메뉴가 오른쪽으로 더 있습니다. 탭하면 스크롤됩니다."
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
