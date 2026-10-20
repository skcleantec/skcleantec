import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { LineMdIcon } from '../../../components/ui/LineMdIcon';
import { useModalScrollKeyboardAvoidance } from '../../../hooks/useMobileInputVisibility';

export function PgPartnerModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { onFieldFocus } = useModalScrollKeyboardAvoidance(scrollRef, true);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="modal-mobile-safe-overlay fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="modal-mobile-fullscreen-panel flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-4 py-3">
          <h2 className="min-w-0 truncate text-fluid-sm font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            aria-label="닫기"
            onClick={onClose}
            className="inline-flex size-10 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          >
            <LineMdIcon name="close" className="size-5" />
          </button>
        </header>
        <div
          ref={scrollRef}
          onFocusCapture={onFieldFocus}
          className="modal-form-scroll-surface min-h-0 flex-1 overflow-y-auto p-4"
        >
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
