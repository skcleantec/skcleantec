import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';
import { HelpTooltip } from '../../ui/HelpTooltip';

/** 우측에서 슬라이드되는 CRM 패널 */
export function CrmRightSlideDrawer({
  open,
  title,
  subtitle,
  titleAddon,
  onClose,
  widthClass = 'w-[min(360px,92vw)]',
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  /** 제목 옆 작은 요소 (도움말 등) — 선택 */
  titleAddon?: ReactNode;
  onClose: () => void;
  widthClass?: string;
  children: ReactNode;
}) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={[open ? 'pointer-events-auto' : 'pointer-events-none', 'fixed inset-0 z-[180]'].join(
        ' ',
      )}
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
          'fixed right-0 top-0 flex h-full min-h-0 flex-col border-l border-slate-200 bg-white shadow-2xl',
          'transition-transform duration-300 ease-out motion-reduce:transition-none',
          open ? 'translate-x-0' : 'translate-x-full',
          widthClass,
        ].join(' ')}
        role="dialog"
        aria-modal="true"
        aria-labelledby="crm-right-slide-drawer-title"
        aria-hidden={!open}
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <h2 id="crm-right-slide-drawer-title" className="truncate whitespace-nowrap text-fluid-sm font-semibold text-slate-900">
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
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">{children}</div>
      </aside>
    </div>,
    document.body,
  );
}
