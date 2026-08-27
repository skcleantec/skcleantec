export function AiSparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2.5l1.2 4.2a2 2 0 001.2 1.2L18.5 9l-4.1 1.1a2 2 0 00-1.2 1.2L12 15.5l-1.2-4.2a2 2 0 00-1.2-1.2L5.5 9l4.1-1.1a2 2 0 001.2-1.2L12 2.5z" />
      <path d="M18.5 14.5l.55 1.9a1 1 0 00.6.6l1.85.5-1.85.5a1 1 0 00-.6.6l-.55 1.9-.55-1.9a1 1 0 00-.6-.6l-1.85-.5 1.85-.5a1 1 0 00.6-.6l.55-1.9z" opacity=".85" />
    </svg>
  );
}

/** PC·모바일 공통 — AI 빠른등록 트리거 (모달 CTA와 동일 톤) */
export function InquiryQuickPasteTriggerButton({
  onClick,
  className = '',
  size = 'default',
}: {
  onClick: () => void;
  className?: string;
  size?: 'default' | 'compact' | 'row' | 'responsive-compact';
}) {
  const sizeClass =
    size === 'compact'
      ? 'h-auto w-auto gap-1.5 rounded-lg px-3 py-2 text-fluid-xs shadow-sm shadow-violet-500/20'
      : size === 'responsive-compact'
        ? 'min-h-8 w-auto gap-1 lg:gap-1.5 rounded-lg px-1.5 sm:px-2 py-1 lg:px-3 lg:py-2 text-[12px] sm:text-fluid-2xs lg:text-fluid-xs shadow-sm shadow-violet-500/20 whitespace-nowrap'
      : size === 'row'
        ? 'min-h-9 min-w-0 flex-1 gap-1 rounded-md px-1.5 py-1 text-fluid-2xs shadow-sm shadow-violet-500/20'
        : 'min-h-11 w-full gap-2 rounded-xl px-4 py-2.5 text-fluid-sm shadow-md shadow-violet-500/25';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative inline-flex items-center justify-center overflow-hidden border border-violet-200/90 bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-600 font-semibold text-white transition hover:brightness-110 hover:shadow-lg hover:shadow-violet-500/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/80 focus-visible:ring-offset-1 touch-manipulation active:scale-[0.99] ${sizeClass} ${className}`}
      aria-label="AI 빠른등록"
    >
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent animate-quick-paste-ai-btn-shimmer" />
      <span className={`relative inline-flex min-w-0 items-center justify-center ${size === 'default' ? 'gap-2' : 'gap-1'}`}>
        <AiSparkleIcon className={`shrink-0 opacity-95 ${size === 'default' ? 'h-4 w-4' : 'h-3 w-3'}`} />
        <span className="truncate">
          AI<span className={size === 'responsive-compact' ? 'hidden sm:inline' : ''}> 빠른</span>등록
        </span>
      </span>
    </button>
  );
}
