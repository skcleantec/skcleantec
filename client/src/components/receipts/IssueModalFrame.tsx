import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { LineMdIcon } from '../ui/LineMdIcon';
import { useModalScrollKeyboardAvoidance } from '../../hooks/useMobileInputVisibility';

export function IssueModalFrame({
  title,
  onClose,
  children,
  footer,
  inline = false,
  hideHeader = false,
  softCard = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  inline?: boolean;
  /** 제목·닫기를 폼 안에서 그릴 때 */
  hideHeader?: boolean;
  /** 흰 카드 + 바깥 #F1F4F9 (현금영수증 발행 폼) */
  softCard?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { onFieldFocus } = useModalScrollKeyboardAvoidance(scrollRef, true);

  useEffect(() => {
    if (inline) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [inline, onClose]);

  const panel = (
    <div
      className={
        softCard
          ? inline
            ? 'flex w-full flex-col rounded-[20px] bg-[#F1F4F9] p-3 sm:p-4'
            : 'modal-mobile-fullscreen-panel flex max-h-[100dvh] w-full flex-col bg-[#F1F4F9] p-3 lg:max-h-[90vh] lg:max-w-[640px] lg:rounded-[20px]'
          : inline
            ? 'flex w-full flex-col rounded-xl border border-slate-200 bg-white'
            : 'modal-mobile-fullscreen-panel flex max-h-[100dvh] w-full flex-col bg-white lg:max-h-[90vh] lg:max-w-[640px] lg:rounded-2xl'
      }
      role="dialog"
      aria-modal={inline ? undefined : true}
      aria-label={title}
      onMouseDown={(event) => event.stopPropagation()}
    >
      {softCard ? (
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.06)]">
          {hideHeader ? null : (
            <header className="flex shrink-0 items-center justify-between gap-2 px-5 py-3">
              <h2 className="text-[16px] font-bold text-slate-900">{title}</h2>
              {inline ? null : (
                <button
                  type="button"
                  className="inline-flex size-9 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
                  aria-label="닫기"
                  onClick={onClose}
                >
                  <LineMdIcon name="close" className="size-5" />
                </button>
              )}
            </header>
          )}
          <div
            ref={scrollRef}
            className="modal-form-scroll-surface min-h-0 flex-1 space-y-0 overflow-y-auto px-5 py-5"
            onFocusCapture={onFieldFocus}
          >
            {children}
          </div>
          {footer ? <footer className="shrink-0 px-5 pb-5 pt-0">{footer}</footer> : null}
        </div>
      ) : (
        <>
          {hideHeader ? null : (
            <header className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
              <h2 className="text-fluid-sm font-semibold text-slate-900">{title}</h2>
              {inline ? null : (
                <button
                  type="button"
                  className="inline-flex size-11 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
                  aria-label="닫기"
                  onClick={onClose}
                >
                  <LineMdIcon name="close" className="size-5" />
                </button>
              )}
            </header>
          )}
          <div ref={scrollRef} className="modal-form-scroll-surface min-h-0 flex-1 space-y-3 overflow-y-auto p-3" onFocusCapture={onFieldFocus}>
            {children}
          </div>
          {footer ? <footer className="shrink-0 border-t border-slate-200 px-3 py-2">{footer}</footer> : null}
        </>
      )}
    </div>
  );
  if (inline) return panel;
  return createPortal(
    <div className="modal-mobile-safe-overlay fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/40 lg:items-center" role="presentation" onMouseDown={onClose}>
      {panel}
    </div>,
    document.body,
  );
}
