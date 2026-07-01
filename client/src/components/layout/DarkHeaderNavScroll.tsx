import type { ReactNode } from 'react';
import { useHorizontalNavScroll } from './useHorizontalNavScroll';

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

/** theme-dark-header GNB — 가로 스크롤 + 좌우 쉐브론 (AdminLayout·TeamLayout 모바일) */
export function DarkHeaderNavScroll({
  children,
  'aria-label': ariaLabel,
  className = '',
  hintKey,
}: DarkHeaderNavScrollProps) {
  const { scrollRef, contentRef, moreLeft, moreRight, updateHints, scrollPrev, scrollNext } =
    useHorizontalNavScroll(hintKey);

  return (
    <div className={`relative min-w-0 w-full max-w-full ${className}`} data-team-mobile-nav>
      <div
        ref={scrollRef}
        role="navigation"
        aria-label={ariaLabel}
        onScroll={updateHints}
        className={`min-w-0 w-full max-w-full overflow-x-auto overflow-y-hidden overscroll-x-contain pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
          moreLeft ? 'scroll-pl-10' : ''
        } ${moreRight ? 'scroll-pr-10' : ''}`}
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        <div ref={contentRef} className="flex w-max min-w-0 flex-nowrap items-center gap-1 sm:gap-2">
          {children}
        </div>
      </div>
      {moreLeft ? (
        <div className="pointer-events-none absolute inset-y-0 left-0 z-30 flex items-center justify-start">
          <div
            className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-slate-900 via-slate-900/95 to-transparent sm:w-14"
            aria-hidden
          />
          <button
            type="button"
            data-admin-nav-scroll-btn
            onClick={scrollPrev}
            className="pointer-events-auto relative ml-0.5 flex h-9 w-9 shrink-0 touch-manipulation items-center justify-center rounded-full border border-white/30 bg-slate-700/95 text-white shadow-md shadow-black/25 transition-all hover:bg-slate-600 hover:border-white/40 active:scale-95"
            aria-label="메뉴가 왼쪽으로 더 있습니다. 탭하면 스크롤됩니다."
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
        </div>
      ) : null}
      {moreRight ? (
        <div className="pointer-events-none absolute inset-y-0 right-0 z-30 flex items-center justify-end">
          <div
            className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-slate-900 via-slate-900/90 to-transparent sm:w-14"
            aria-hidden
          />
          <button
            type="button"
            data-admin-nav-scroll-btn
            onClick={scrollNext}
            className="pointer-events-auto relative mr-0.5 flex h-9 w-9 shrink-0 touch-manipulation items-center justify-center rounded-full border border-white/30 bg-slate-700/95 text-white shadow-md shadow-black/25 transition-all hover:bg-slate-600 hover:border-white/40 active:scale-95"
            aria-label="메뉴가 오른쪽으로 더 있습니다. 탭하면 스크롤됩니다."
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
