import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type CrmAccent = 'intake' | 'script' | 'pricing' | 'soomgo';

export const CRM_ACCENT: Record<
  CrmAccent,
  {
    header: string;
    iconBg: string;
    iconText: string;
    chipActive: string;
    chipIdle: string;
    segmentActive: string;
    panel: string;
    ring: string;
  }
> = {
  intake: {
    header: 'from-emerald-500/12 via-teal-500/8 to-white',
    iconBg: 'bg-gradient-to-br from-emerald-500 to-teal-600',
    iconText: 'text-white',
    chipActive: 'bg-emerald-600 text-white shadow-sm shadow-emerald-200',
    chipIdle: 'border border-emerald-100 bg-emerald-50/80 text-emerald-800 hover:bg-emerald-100',
    segmentActive: 'bg-emerald-600 text-white shadow-sm',
    panel: 'border-emerald-100 bg-emerald-50/40',
    ring: 'ring-emerald-200',
  },
  script: {
    header: 'from-violet-500/12 via-indigo-500/8 to-white',
    iconBg: 'bg-gradient-to-br from-violet-500 to-indigo-600',
    iconText: 'text-white',
    chipActive: 'bg-violet-600 text-white shadow-sm shadow-violet-200',
    chipIdle: 'border border-violet-100 bg-violet-50/80 text-violet-800 hover:bg-violet-100',
    segmentActive: 'bg-violet-600 text-white shadow-sm',
    panel: 'border-violet-100 bg-violet-50/40',
    ring: 'ring-violet-200',
  },
  pricing: {
    header: 'from-amber-400/15 via-orange-400/10 to-white',
    iconBg: 'bg-gradient-to-br from-amber-500 to-orange-500',
    iconText: 'text-white',
    chipActive: 'bg-amber-500 text-white shadow-sm shadow-amber-200',
    chipIdle: 'border border-amber-100 bg-amber-50/80 text-amber-900 hover:bg-amber-100',
    segmentActive: 'bg-amber-500 text-white shadow-sm',
    panel: 'border-amber-100 bg-amber-50/50',
    ring: 'ring-amber-200',
  },
  soomgo: {
    header: 'from-sky-500/12 via-cyan-500/8 to-white',
    iconBg: 'bg-gradient-to-br from-sky-500 to-cyan-600',
    iconText: 'text-white',
    chipActive: 'bg-sky-600 text-white shadow-sm shadow-sky-200',
    chipIdle: 'border border-sky-100 bg-sky-50/80 text-sky-800 hover:bg-sky-100',
    segmentActive: 'bg-sky-600 text-white shadow-sm',
    panel: 'border-sky-100 bg-sky-50/40',
    ring: 'ring-sky-200',
  },
};

export function CrmIconIntake({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path strokeLinecap="round" d="M16 2v4M8 2v4M4 9h16" />
      <rect x="3" y="4" width="18" height="17" rx="2.5" />
      <path strokeLinecap="round" d="M8 14h8M8 18h5" />
    </svg>
  );
}

export function CrmIconScript({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path strokeLinecap="round" d="M8 9h8M8 13h6" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 4h12a2 2 0 012 2v14l-4-2-4 2-4-2-4 2V6a2 2 0 012-2z" />
    </svg>
  );
}

export function CrmIconPricing({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="12" r="8.5" />
      <path strokeLinecap="round" d="M12 7v10M9.5 9.5h3a1.5 1.5 0 010 3h-2a1.5 1.5 0 000 3h4" />
    </svg>
  );
}

export function CrmIconSoomgo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" />
    </svg>
  );
}

export function CrmIconPhone({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.12.86.3 1.713.45 2.57a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.857.15 1.71.33 2.57.45A2 2 0 0122 16.92z"
      />
    </svg>
  );
}

export function CrmIconCopy({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path strokeLinecap="round" d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2" />
    </svg>
  );
}

export function CrmIconSearch({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="11" cy="11" r="6" />
      <path strokeLinecap="round" d="M20 20l-3-3" />
    </svg>
  );
}

export function CrmIconUser({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="8" r="3.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" />
    </svg>
  );
}

export function CrmIconReset({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 20v-5h-5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 9a7 7 0 0112.5-2.5L20 4M19 15a7 7 0 01-12.5 2.5L4 20" />
    </svg>
  );
}

export function CrmColumnIcon({ accent }: { accent: CrmAccent }) {
  const tone = CRM_ACCENT[accent];
  const Icon =
    accent === 'intake'
      ? CrmIconIntake
      : accent === 'script'
        ? CrmIconScript
        : accent === 'soomgo'
          ? CrmIconSoomgo
          : CrmIconPricing;
  return (
    <span
      className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg shadow-sm ${tone.iconBg} ${tone.iconText}`}
    >
      <Icon className="h-4 w-4" />
    </span>
  );
}

export function CrmSegment({
  children,
  className = '',
}: {
  accent?: CrmAccent;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`inline-flex rounded-xl border border-slate-200/80 bg-slate-50/90 p-1 shadow-inner ${className}`}
    >
      {children}
    </div>
  );
}

export function CrmSegmentItem({
  accent,
  active,
  onClick,
  children,
  icon,
  compact = false,
}: {
  accent: CrmAccent;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  icon?: ReactNode;
  compact?: boolean;
}) {
  const tone = CRM_ACCENT[accent];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-lg font-semibold transition-all whitespace-nowrap ${
        compact ? 'px-2 py-1 text-[11px]' : 'gap-1.5 px-3 py-2 text-fluid-xs'
      } ${active ? tone.segmentActive : 'text-slate-600 hover:bg-white/80'}`}
    >
      {icon ? <span className={`shrink-0 ${active ? 'opacity-95' : 'opacity-70'}`}>{icon}</span> : null}
      {children}
    </button>
  );
}

export function CrmChip({
  accent,
  active,
  onClick,
  children,
  title,
  compact = false,
}: {
  accent: CrmAccent;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  title?: string;
  compact?: boolean;
}) {
  const tone = CRM_ACCENT[accent];
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`font-semibold whitespace-nowrap transition-all ${
        compact ? 'rounded-md px-2 py-0.5 text-[10px]' : 'rounded-lg px-3 py-1.5 text-fluid-xs'
      } ${active ? tone.chipActive : tone.chipIdle}`}
    >
      {children}
    </button>
  );
}

export function CrmActionButton({
  accent = 'script',
  variant = 'soft',
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  accent?: CrmAccent;
  variant?: 'soft' | 'solid';
}) {
  const tone = CRM_ACCENT[accent];
  const base =
    variant === 'solid'
      ? `${tone.chipActive} px-3 py-1.5 rounded-lg text-fluid-xs font-semibold inline-flex items-center gap-1.5`
      : `border ${tone.chipIdle} px-3 py-1.5 rounded-lg text-fluid-xs font-semibold inline-flex items-center gap-1.5 hover:shadow-sm`;
  return (
    <button type="button" className={`${base} disabled:opacity-40 ${className}`} {...props}>
      {children}
    </button>
  );
}

export function CrmSectionLabel({
  accent,
  children,
}: {
  accent: CrmAccent;
  children: ReactNode;
}) {
  const color =
    accent === 'intake' ? 'text-emerald-700' : accent === 'script' ? 'text-violet-700' : 'text-amber-800';
  return (
    <p className={`mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide ${color}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" aria-hidden />
      {children}
    </p>
  );
}

export const crmFieldClass =
  'w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-fluid-sm shadow-sm transition-shadow focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200/80';

export const crmFieldCompactClass =
  'w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-fluid-xs shadow-sm transition-shadow focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200/80';

export const crmSearchFieldClass =
  'w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-fluid-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200/80';
