import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

/** 우측에서 슬라이드되는 CRM 패널 */
export function CrmRightSlideDrawer({
  open,
  title,
  subtitle,
  onClose,
  widthClass = 'w-[min(360px,92vw)]',
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
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
          'fixed right-0 top-0 flex h-full min-h-0 flex-col border-l border-gray-200 bg-white shadow-2xl',
          'transition-transform duration-300 ease-out motion-reduce:transition-none',
          open ? 'translate-x-0' : 'translate-x-full',
          widthClass,
        ].join(' ')}
        role="dialog"
        aria-modal="true"
        aria-labelledby="crm-right-slide-drawer-title"
        aria-hidden={!open}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-100 px-4 py-3">
          <div className="min-w-0">
            <h2 id="crm-right-slide-drawer-title" className="text-fluid-sm font-semibold text-gray-900">
              {title}
            </h2>
            {subtitle ? <p className="mt-0.5 text-fluid-xs text-gray-500">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-fluid-xs text-gray-700 hover:bg-gray-50"
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
