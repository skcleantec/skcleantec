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
  headerBelow,
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
  /** 헤더 제목 아래 보조 줄 (작업 브랜드 등) */
  headerBelow?: ReactNode;
}) {
  const tone = CRM_ACCENT[accent];
  return (
    <div
      className={`flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-md shadow-slate-200/40 ${className}`}
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
        {headerBelow ? <div className="mt-1.5">{headerBelow}</div> : null}
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
  /** 숨고 2분할 — 창 폭에 맞춰 3열 축소 */
  splitLayout = false,
  /** 팝업·전체 창 — min-w-[1280px] 대신 w-full (가로 overflow 방지) */
  fillViewport = false,
}: {
  header: ReactNode;
  topBar?: ReactNode;
  toolNav?: ReactNode;
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
  /** Android 앱 WebView — 1열 스택 */
  mobile?: boolean;
  splitLayout?: boolean;
  fillViewport?: boolean;
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
    <div
      className={`box-border flex h-full w-full flex-col bg-gradient-to-br from-slate-100 via-indigo-50/30 to-slate-100 ${
        splitLayout || fillViewport ? 'min-w-0 max-w-full' : 'min-w-[1280px]'
      }`}
    >
      {header}
      {topBar}
      <div className="box-border flex min-h-0 min-w-0 flex-1 gap-3 p-3">
        {toolNav}
        <div className="grid h-full min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,28fr)_minmax(0,40fr)_minmax(0,32fr)] gap-3">
          <div className="flex h-full min-h-0 min-w-0 flex-col">{left}</div>
          <div className="flex h-full min-h-0 min-w-0 flex-col">{center}</div>
          <div className="flex h-full min-h-0 min-w-0 flex-col">{right}</div>
        </div>
      </div>
    </div>
  );
}
