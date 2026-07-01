import { createPortal } from 'react-dom';
import type { ReactNode } from 'react';

export function CrmDrawerShell({
  open,
  title,
  subtitle,
  onClose,
  widthClass = 'w-[min(520px,92vw)]',
  children,
}: {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  widthClass?: string;
  children: ReactNode;
}) {
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[180] flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/35"
        aria-label="닫기"
        onClick={onClose}
      />
      <aside
        className={`relative flex h-full min-h-0 flex-col border-l border-gray-200 bg-white shadow-2xl ${widthClass}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="crm-drawer-title"
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-100 px-4 py-3">
          <div className="min-w-0">
            <h2 id="crm-drawer-title" className="text-fluid-sm font-semibold text-gray-900">
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
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">{children}</div>
      </aside>
    </div>,
    document.body,
  );
}
