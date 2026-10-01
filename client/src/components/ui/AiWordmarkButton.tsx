import type { ReactNode } from 'react';

const word =
  'bg-gradient-to-br from-cyan-400 via-sky-500 to-violet-500 bg-clip-text text-transparent';

function Spark({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute block ${className}`}
      style={{
        clipPath: 'polygon(50% 0, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0 50%, 38% 38%)',
      }}
    />
  );
}

/** 가로 막대. Ai 글자와 라벨만 두고 움직임은 없다. */
export function AiWordmarkButton({
  label,
  ariaLabel,
  onClick,
  disabled,
  size = 'compact',
  mark = true,
  tone = 'light',
  className = '',
}: {
  label: ReactNode;
  ariaLabel: string;
  onClick: () => void;
  disabled?: boolean;
  size?: 'default' | 'compact' | 'row' | 'responsive-compact';
  mark?: boolean;
  tone?: 'light' | 'dark';
  className?: string;
}) {
  const sizeClass =
    size === 'compact'
      ? 'h-auto w-auto shrink-0 gap-1.5 rounded-2xl px-3 py-2'
      : size === 'responsive-compact'
        ? 'min-h-8 w-auto gap-1 whitespace-nowrap rounded-xl px-2 py-1 lg:gap-1.5 lg:rounded-2xl lg:px-3 lg:py-2'
        : size === 'row'
          ? 'min-h-9 min-w-0 flex-1 gap-1 rounded-xl px-1.5 py-1'
          : 'min-h-11 w-full gap-2 rounded-2xl px-4 py-2.5';
  const aiClass =
    size === 'row' || size === 'responsive-compact' ? 'text-fluid-sm' : size === 'default' ? 'text-fluid-lg' : 'text-fluid-base';
  const labelClass =
    size === 'row' || size === 'responsive-compact' ? 'text-fluid-2xs lg:text-fluid-xs' : 'text-fluid-xs';
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      className={`inline-flex items-center justify-center border font-semibold touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ${
        tone === 'dark'
          ? 'border-black bg-black shadow-[0_8px_18px_-8px_rgba(15,23,42,0.55)] hover:bg-slate-900 focus-visible:ring-slate-400'
          : 'border-slate-200/90 bg-white shadow-[0_8px_18px_-10px_rgba(15,23,42,0.45)] hover:bg-slate-50 hover:shadow-[0_10px_22px_-10px_rgba(15,23,42,0.5)] focus-visible:ring-sky-400'
      } ${sizeClass} ${className}`}
    >
      {mark ? (
        <span className={`relative inline-flex shrink-0 items-center pr-2 leading-none ${aiClass}`}>
          <span className={`font-semibold tracking-tight ${word}`}>Ai</span>
          <Spark className="right-0.5 top-0 size-1.5 bg-cyan-400" />
          <Spark className="right-0 top-2 size-1 bg-violet-500" />
        </span>
      ) : null}
      <span className={`min-w-0 truncate font-medium leading-none ${word} ${labelClass}`}>{label}</span>
    </button>
  );
}
