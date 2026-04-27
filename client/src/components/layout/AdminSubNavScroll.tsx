import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

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

/** 접수·팀장 등 관리자 하위 탭 — 좁은 폭에서 글자 축소 + 가로 스크롤·쉐브론 */
export function adminSubNavTabClassName(isActive: boolean, extraClass?: string) {
  const state = isActive
    ? 'border-blue-600 text-gray-900 bg-white'
    : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300';
  return [
    'inline-flex items-center justify-center px-2 min-[380px]:px-2.5 sm:px-3 py-1.5 sm:py-2',
    'text-[clamp(0.62rem,2.3vw+0.2rem,0.875rem)] font-medium leading-tight rounded-t border-b-2 -mb-px shrink-0 whitespace-nowrap max-w-[min(100%,11rem)] truncate sm:max-w-none',
    state,
    extraClass,
  ]
    .filter(Boolean)
    .join(' ');
}

type AdminSubNavScrollProps = {
  children: ReactNode;
  /** 스크린리더용 하위 메뉴 설명 */
  'aria-label': string;
  className?: string;
};

/**
 * 하위 메뉴 가로 스트립: 넘치면 스크롤 + 좌우 이동 버튼(발주서 화면과 동일 패턴).
 * `mb-6` 포함.
 */
export function AdminSubNavScroll({ children, 'aria-label': ariaLabel, className = '' }: AdminSubNavScrollProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [moreLeft, setMoreLeft] = useState(false);
  const [moreRight, setMoreRight] = useState(false);
  const location = useLocation();

  const updateHints = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const overflow = scrollWidth > clientWidth + 2;
    const atStart = scrollLeft <= 3;
    const atEnd = scrollLeft + clientWidth >= scrollWidth - 3;
    setMoreLeft(overflow && !atStart);
    setMoreRight(overflow && !atEnd);
  }, []);

  useEffect(() => {
    queueMicrotask(() => updateHints());
  }, [location.pathname, updateHints]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => updateHints());
    ro.observe(el);
    window.addEventListener('resize', updateHints);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateHints);
    };
  }, [updateHints]);

  const scrollStep = () => {
    const el = scrollRef.current;
    if (!el) return 140;
    return Math.min(160, Math.max(72, Math.round(el.clientWidth * 0.45)));
  };

  const scrollLeft = () => {
    scrollRef.current?.scrollBy({ left: -scrollStep(), behavior: 'smooth' });
  };
  const scrollRight = () => {
    scrollRef.current?.scrollBy({ left: scrollStep(), behavior: 'smooth' });
  };

  return (
    <div className={`mb-6 min-w-0 w-full max-w-full ${className}`}>
      <div className="relative min-w-0">
        <div
          ref={scrollRef}
          role="navigation"
          aria-label={ariaLabel}
          onScroll={updateHints}
          className="flex min-w-0 flex-nowrap items-center gap-0.5 sm:gap-1 overflow-x-auto overflow-y-hidden overscroll-x-contain border-b border-gray-200 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          {children}
        </div>
        {moreLeft && (
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center justify-start">
            <div
              className="pointer-events-none absolute inset-y-0 left-0 w-14 bg-gradient-to-r from-gray-50 via-gray-50/95 to-transparent"
              aria-hidden
            />
            <button
              type="button"
              onClick={scrollLeft}
              className="pointer-events-auto relative ml-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm active:bg-gray-50 sm:h-9 sm:w-9"
              aria-label="하위 메뉴가 왼쪽으로 더 있습니다. 탭하면 스크롤됩니다."
            >
              <ChevronLeftIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </div>
        )}
        {moreRight && (
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 flex items-center justify-end">
            <div
              className="pointer-events-none absolute inset-y-0 right-0 w-14 bg-gradient-to-l from-gray-50 via-gray-50/95 to-transparent"
              aria-hidden
            />
            <button
              type="button"
              onClick={scrollRight}
              className="pointer-events-auto relative mr-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm active:bg-gray-50 sm:h-9 sm:w-9"
              aria-label="하위 메뉴가 오른쪽으로 더 있습니다. 탭하면 스크롤됩니다."
            >
              <ChevronRightIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
