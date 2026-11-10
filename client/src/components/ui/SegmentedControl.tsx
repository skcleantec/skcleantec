import type { ReactNode } from 'react';

export type SegmentedOption<T extends string> = {
  value: T;
  label: ReactNode;
  disabled?: boolean;
};

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className = '',
}: {
  value: T;
  onChange: (next: T) => void;
  options: SegmentedOption<T>[];
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`inline-flex w-full max-w-full rounded-[10px] bg-[#EEF1F6] p-[3px] lg:w-auto ${className}`}
    >
      {options.map((opt) => {
        const on = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={opt.disabled}
            className={`h-[30px] min-w-0 flex-1 rounded-[8px] px-2 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 disabled:opacity-50 lg:flex-none lg:px-3 ${
              on
                ? 'bg-white font-semibold text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.08)]'
                : 'bg-transparent font-normal text-[#64748B]'
            }`}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
