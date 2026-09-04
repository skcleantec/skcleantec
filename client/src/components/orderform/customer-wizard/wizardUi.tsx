import type { ReactNode } from 'react';

export const WIZARD_INPUT_CLS =
  'w-full min-h-12 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-fluid-sm text-slate-900 focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/15 disabled:bg-slate-100 disabled:text-slate-500 disabled:pointer-events-none';

export const WIZARD_CTA_CLS =
  'w-full min-h-12 rounded-xl bg-slate-900 py-3 text-fluid-sm font-semibold text-white shadow-md shadow-slate-900/15 hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-45 disabled:pointer-events-none';

export const WIZARD_SECONDARY_CLS =
  'w-full min-h-12 rounded-xl border border-slate-200 bg-white py-3 text-fluid-sm font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-45 disabled:pointer-events-none';

export function WizardQuestion({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <h2
          className="text-2xl font-bold leading-snug tracking-tight text-slate-900 sm:text-3xl"
          aria-live="polite"
        >
          {title}
        </h2>
        {hint ? <p className="text-fluid-sm leading-relaxed text-slate-500">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

export function WizardChoiceChip({
  selected,
  onSelect,
  children,
  disabled,
}: {
  selected: boolean;
  onSelect: () => void;
  children: ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      className={[
        'min-h-[52px] w-full rounded-2xl border-2 px-4 py-3 text-left text-fluid-sm font-semibold transition touch-manipulation',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2',
        'disabled:opacity-45 disabled:pointer-events-none',
        selected
          ? 'border-slate-900 bg-slate-900 text-white'
          : 'border-slate-200 bg-white text-slate-900 hover:border-slate-400 hover:bg-slate-50',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

export function WizardChipGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">{children}</div>;
}
