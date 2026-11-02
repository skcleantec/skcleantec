import { createPortal } from 'react-dom';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { HelpTooltip } from '../../ui/HelpTooltip';

const TOOL_NAV_COLLAPSED_KEY = 'sk_telecrm_tool_nav_collapsed';
const TOOL_NAV_WIDTH_EXPANDED = 132;
const TOOL_NAV_WIDTH_COLLAPSED = 52;
/** CrmShell `p-3` + 여백 */
const TOOL_NAV_DOCK_GUTTER = 12;

function readToolNavDockLeft(): number {
  try {
    const collapsed = window.localStorage.getItem(TOOL_NAV_COLLAPSED_KEY) === '1';
    return (collapsed ? TOOL_NAV_WIDTH_COLLAPSED : TOOL_NAV_WIDTH_EXPANDED) + TOOL_NAV_DOCK_GUTTER;
  } catch {
    return TOOL_NAV_WIDTH_EXPANDED + TOOL_NAV_DOCK_GUTTER;
  }
}

/** 좌측에서 슬라이드되는 CRM 도구 패널 */
export function CrmSlideDrawer({
  open,
  title,
  subtitle,
  titleAddon,
  onClose,
  widthClass = 'w-[min(420px,92vw)]',
  /** body 전체 스크롤(기본) vs 본문 flex·내부 스크롤(숨고 메시지 등) */
  bodyLayout = 'scroll',
  /** true면 좌측 CRM 도구 메뉴(문자·숨고 메시지 등)를 가리지 않음 */
  dockAfterToolNav = false,
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  /** 제목 옆 작은 요소 (도움말 등) — 선택 */
  titleAddon?: ReactNode;
  onClose: () => void;
  widthClass?: string;
  bodyLayout?: 'scroll' | 'split';
  dockAfterToolNav?: boolean;
  children: ReactNode;
}) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [toolNavLeft, setToolNavLeft] = useState(() =>
    typeof window !== 'undefined' ? readToolNavDockLeft() : TOOL_NAV_WIDTH_EXPANDED + TOOL_NAV_DOCK_GUTTER,
  );

  useEffect(() => {
    if (open) bodyRef.current?.scrollTo({ top: 0, left: 0 });
  }, [open]);

  useEffect(() => {
    if (!dockAfterToolNav) return;
    const sync = () => setToolNavLeft(readToolNavDockLeft());
    if (open) sync();
    window.addEventListener('storage', sync);
    window.addEventListener('telecrm-tool-nav-layout', sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener('telecrm-tool-nav-layout', sync);
    };
  }, [dockAfterToolNav, open]);

  if (typeof document === 'undefined') return null;

  const bodyClass =
    bodyLayout === 'split'
      ? 'flex min-h-0 flex-1 flex-col overflow-hidden overscroll-contain px-4 py-3'
      : 'min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4';

  const dockLeft = dockAfterToolNav ? toolNavLeft : 0;
  const panelTransform = open
    ? 'translateX(0)'
    : dockAfterToolNav
      ? `translateX(calc(-100% - ${dockLeft}px))`
      : 'translateX(-100%)';

  return createPortal(
    <div
      className={[
        'fixed inset-0 z-[180]',
        open ? 'pointer-events-auto' : 'pointer-events-none',
      ].join(' ')}
      aria-hidden={!open}
    >
      <button
        type="button"
        className={[
          'absolute inset-0 bg-black/35 transition-opacity duration-300 motion-reduce:transition-none',
          open ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
        aria-label="닫기"
        onClick={onClose}
        tabIndex={open ? 0 : -1}
      />
      <aside
        className={[
          'fixed top-0 z-10 flex max-h-[100dvh] min-h-0 flex-col border-r border-slate-200 bg-white shadow-2xl',
          'transition-transform duration-300 ease-out motion-reduce:transition-none',
          widthClass,
        ].join(' ')}
        style={{
          left: dockLeft,
          height: '100dvh',
          transform: panelTransform,
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="crm-slide-drawer-title"
        aria-hidden={!open}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <h2 id="crm-slide-drawer-title" className="truncate whitespace-nowrap text-fluid-sm font-semibold text-slate-900">
              {title}
            </h2>
            {subtitle ? <HelpTooltip text={subtitle} className="shrink-0" /> : null}
            {titleAddon}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-7 shrink-0 items-center rounded-lg border border-slate-300 px-3 text-fluid-xs text-slate-700 hover:bg-slate-50"
          >
            닫기
          </button>
        </header>
        <div ref={bodyRef} className={bodyClass}>
          {children}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
