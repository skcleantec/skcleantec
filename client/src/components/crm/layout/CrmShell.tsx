import type { ReactNode } from 'react';

export function CrmColumn({
  title,
  subtitle,
  children,
  className = '',
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex min-h-0 min-w-0 flex-col rounded-2xl border border-gray-200 bg-white shadow-sm ${className}`}
    >
      <div className="shrink-0 border-b border-gray-100 px-4 py-3">
        <h2 className="text-fluid-sm font-semibold text-gray-900">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-fluid-xs text-gray-500">{subtitle}</p> : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
    </div>
  );
}

export function CrmShell({
  header,
  left,
  center,
  right,
}: {
  header: ReactNode;
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
}) {
  return (
    <div className="flex h-screen min-w-[1280px] flex-col bg-slate-100">
      {header}
      <div className="grid min-h-0 flex-1 grid-cols-[28%_40%_32%] gap-3 p-3">
        {left}
        {center}
        {right}
      </div>
    </div>
  );
}
