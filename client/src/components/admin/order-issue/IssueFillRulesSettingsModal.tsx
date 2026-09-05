import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useModalScrollKeyboardAvoidance } from '../../../hooks/useMobileInputVisibility';
import { ModalCloseButton } from '../ModalCloseButton';
import { HelpTooltip } from '../../ui/HelpTooltip';
import { ISSUE_FILL_RULES_PAGE_HELP } from '@shared/orderFormFillRules';
import { IssueFillRulesSettingsPanel } from './IssueFillRulesSettingsPanel';

type Props = {
  open: boolean;
  token: string;
  canSave: boolean;
  onClose: () => void;
};

export function IssueFillRulesSettingsModal({ open, token, canSave, onClose }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { onFieldFocus } = useModalScrollKeyboardAvoidance(scrollRef, open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  const root = typeof document !== 'undefined' ? document.body : null;
  if (!root) return null;

  return createPortal(
    <div
      className="modal-mobile-safe-overlay fixed inset-0 z-[620] flex items-end justify-center bg-black/45 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="issue-fill-rules-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="modal-mobile-fullscreen-panel relative flex h-[100dvh] w-full max-w-3xl flex-col overflow-hidden border border-slate-200 bg-white shadow-xl lg:h-auto lg:max-h-[90vh] lg:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <ModalCloseButton onClick={onClose} />
        <div className="shrink-0 border-b border-slate-200 px-4 pb-3 pt-4 pr-14 sm:px-5 sm:pt-5">
          <div className="flex items-start gap-1.5">
            <h2 id="issue-fill-rules-title" className="text-fluid-sm font-semibold text-slate-900 sm:text-fluid-base">
              작성 설정
            </h2>
            <HelpTooltip className="mt-0.5 shrink-0" text={ISSUE_FILL_RULES_PAGE_HELP} />
          </div>
          <p className="mt-1 text-fluid-2xs text-slate-500 sm:text-fluid-xs">
            누가 어느 칸을 적는지 정합니다. 저장하면 다음 발급부터 적용됩니다.
          </p>
        </div>
        <div
          ref={scrollRef}
          onFocusCapture={onFieldFocus}
          className="modal-form-scroll-surface min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-3 sm:px-5"
        >
          <IssueFillRulesSettingsPanel token={token} canSave={canSave} hideTitle />
        </div>
      </div>
    </div>,
    root,
  );
}
