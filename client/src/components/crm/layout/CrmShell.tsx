import type { ReactNode } from 'react';
import { CRM_ACCENT, CrmColumnIcon, type CrmAccent } from '../crmUi';

export function CrmColumn({
  title,
  subtitle,
  accent,
  children,
  className = '',
  bodyClassName = '',
  disableBodyScroll = false,
  headerAction,
}: {
  title: string;
  subtitle?: string;
  accent: CrmAccent;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** 본문 내부에서 스크롤·푸터 분리 (가격 안내 등) */
  disableBodyScroll?: boolean;
  headerAction?: ReactNode;
}) {
  const tone = CRM_ACCENT[accent];
  return (
    <div
      className={`flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-md shadow-slate-200/40 ${className}`}
    >
      <div
        className={`shrink-0 border-b border-slate-100/80 bg-gradient-to-r ${tone.header} px-3 py-2`}
      >
        <div className="flex items-center gap-2">
          <CrmColumnIcon accent={accent} />
          <div className="min-w-0 flex-1">
            <h2 className="text-fluid-xs font-bold tracking-tight text-slate-900">{title}</h2>
            {subtitle ? <p className="text-[10px] text-slate-500 leading-tight">{subtitle}</p> : null}
          </div>
          {headerAction ? <div className="ml-auto shrink-0">{headerAction}</div> : null}
        </div>
      </div>
      <div
        className={`min-h-0 flex-1 bg-gradient-to-b from-white to-slate-50/40 p-2.5 ${
          disableBodyScroll ? 'flex flex-col overflow-hidden' : 'overflow-y-auto'
        } ${bodyClassName}`}
      >
        {children}
      </div>
    </div>
  );
}

export function CrmShell({
  header,
  topBar,
  toolNav,
  left,
  center,
  right,
  mobile = false,
}: {
  header: ReactNode;
  topBar?: ReactNode;
  toolNav?: ReactNode;
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
  /** Android 앱 WebView — 1열 스택 */
  mobile?: boolean;
}) {
  if (mobile) {
    return (
      <div className="flex h-dvh min-h-0 w-full flex-col bg-gradient-to-br from-slate-100 via-indigo-50/30 to-slate-100">
        {header}
        {topBar}
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-y-contain p-3">
          {left}
          {center}
          {right}
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-screen min-w-[1280px] flex-col bg-gradient-to-br from-slate-100 via-indigo-50/30 to-slate-100">
      {header}
      {topBar}
      <div className="flex min-h-0 flex-1 gap-3 p-3">
        {toolNav}
        <div className="grid min-h-0 min-w-0 flex-1 grid-cols-[28%_40%_32%] gap-3">
          {left}
          {center}
          {right}
        </div>
      </div>
    </div>
  );
}
