import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useModalScrollKeyboardAvoidance } from '../../../hooks/useMobileInputVisibility';
import { LineMdIcon } from '../../ui/LineMdIcon';
import { ModalCloseButton } from '../ModalCloseButton';
import type { AdminOnlyHelpPage } from './adminOnlyHelpContent';

type Props = {
  open: boolean;
  onClose: () => void;
  page: AdminOnlyHelpPage;
};

export function AdminOnlyHelpModal({ open, onClose, page }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { onFieldFocus } = useModalScrollKeyboardAvoidance(scrollRef, open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="modal-mobile-safe-overlay fixed inset-0 z-[620] flex items-stretch justify-center bg-black/50 backdrop-blur-[2px] p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="modal-mobile-fullscreen-panel relative flex h-[100dvh] w-full max-w-lg flex-col overflow-hidden bg-white shadow-2xl ring-1 ring-black/5 sm:h-auto sm:max-h-[min(92vh,40rem)] sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-only-help-title"
        onClick={(e) => e.stopPropagation()}
      >
        <ModalCloseButton onClick={onClose} />
        <div className="shrink-0 border-b border-slate-100 bg-slate-800 px-4 pb-3.5 pt-5 pr-14 text-white">
          <p className="text-fluid-2xs font-medium tracking-wide text-slate-300">관리자 전용</p>
          <h2 id="admin-only-help-title" className="mt-0.5 text-base font-semibold tracking-tight">
            {page.title} 도움말
          </h2>
        </div>

        <div
          ref={scrollRef}
          className="modal-form-scroll-surface min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-4 sm:px-5"
          onFocusCapture={onFieldFocus}
        >
          <p className="whitespace-pre-line text-fluid-sm leading-relaxed text-slate-700">{page.intro}</p>

          <div className="mt-4 space-y-2.5">
            {page.steps.map((step) => (
              <section
                key={step.title}
                className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
              >
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                    <LineMdIcon name={step.icon} className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-fluid-sm font-semibold text-slate-900">{step.title}</h3>
                    <p className="mt-1.5 whitespace-pre-line text-fluid-xs leading-relaxed text-slate-600">
                      {step.body}
                    </p>
                  </div>
                </div>
              </section>
            ))}
          </div>

          {page.faqs && page.faqs.length > 0 ? (
            <section className="mt-4 space-y-2">
              <h3 className="text-fluid-sm font-semibold text-slate-900">자주 묻는 말</h3>
              {page.faqs.map((faq) => (
                <div
                  key={faq.q}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
                >
                  <p className="text-fluid-xs font-semibold text-slate-800">{faq.q}</p>
                  <p className="mt-1.5 whitespace-pre-line text-fluid-xs leading-relaxed text-slate-600">
                    {faq.a}
                  </p>
                </div>
              ))}
            </section>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-slate-100 bg-slate-50/90 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-10 rounded-lg border border-slate-300 bg-white px-4 py-2 text-fluid-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          >
            닫기
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
