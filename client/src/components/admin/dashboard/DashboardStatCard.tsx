import type { ReactNode } from 'react';

export function DashboardStatCard({
  label,
  value,
  theme = 'slate',
  icon,
  onClick,
  compact = false,
}: {
  label: string;
  value: number | string;
  theme?: 'indigo' | 'amber' | 'rose' | 'emerald' | 'slate';
  icon?: ReactNode;
  onClick?: () => void;
  compact?: boolean;
}) {
  const themeClasses = {
    indigo: 'bg-indigo-50/30 border-indigo-100 hover:border-indigo-200 text-indigo-600 ring-indigo-500/5',
    amber: 'bg-amber-50/30 border-amber-100 hover:border-amber-200 text-amber-600 ring-amber-500/5',
    rose: 'bg-rose-50/30 border-rose-100 hover:border-rose-200 text-rose-600 ring-rose-500/5',
    emerald: 'bg-emerald-50/30 border-emerald-100 hover:border-emerald-200 text-emerald-600 ring-emerald-500/5',
    slate: 'bg-white border-slate-200 hover:border-slate-300 text-slate-600 ring-slate-900/5',
  };

  const iconClasses = {
    indigo: 'text-indigo-600 bg-indigo-100/60',
    amber: 'text-amber-600 bg-amber-100/60',
    rose: 'text-rose-600 bg-rose-100/60',
    emerald: 'text-emerald-600 bg-emerald-100/60',
    slate: 'text-gray-500 bg-gray-100/80',
  };

  const inner = (
    <div className="flex items-center justify-between w-full min-w-0">
      <div className="min-w-0">
        <p className="text-fluid-xs font-semibold text-slate-500 truncate">{label}</p>
        <p
          className={`font-bold text-slate-950 tabular-nums tracking-tight ${
            compact ? 'text-fluid-lg mt-1' : 'text-fluid-2xl mt-1.5'
          }`}
        >
          {value}
        </p>
      </div>
      {icon ? (
        <div className={`rounded-xl shrink-0 ${compact ? 'p-2' : 'p-2.5'} ${iconClasses[theme]}`}>
          {icon}
        </div>
      ) : null}
    </div>
  );

  const base = `rounded-2xl text-left w-full border shadow-sm transition-all duration-200 ${
    compact ? 'p-4' : 'p-5'
  } ${themeClasses[theme]}`;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={`${label} — 서비스접수로 이동`}
        className={`${base} cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:translate-y-0`}
      >
        {inner}
      </button>
    );
  }
  return <div className={base}>{inner}</div>;
}
