import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { LineMdIcon } from '../ui/LineMdIcon';
import { useModalScrollKeyboardAvoidance } from '../../hooks/useMobileInputVisibility';

export function IssueModalFrame({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
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
    <div className="modal-mobile-safe-overlay fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/40 lg:items-center" role="presentation" onMouseDown={onClose}>
      <div
        className="modal-mobile-fullscreen-panel flex max-h-[100dvh] w-full flex-col bg-white lg:max-h-[90vh] lg:max-w-[640px] lg:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
          <h2 className="text-fluid-sm font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            className="inline-flex size-11 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
            aria-label="닫기"
            onClick={onClose}
          >
            <LineMdIcon name="close" className="size-5" />
          </button>
        </header>
        <div ref={scrollRef} className="modal-form-scroll-surface min-h-0 flex-1 space-y-3 overflow-y-auto p-3" onFocusCapture={onFieldFocus}>
          {children}
        </div>
        {footer ? <footer className="shrink-0 border-t border-slate-200 px-3 py-2">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}
