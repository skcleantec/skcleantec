import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ORDER_FORM_EXTRA_WORK_CONSENT_PHRASE } from '@shared/orderFormConsents';
import { useModalScrollKeyboardAvoidance } from '../../hooks/useMobileInputVisibility';
import { ModalCloseButton } from '../admin/ModalCloseButton';
import { WIZARD_CTA_CLS, WIZARD_INPUT_CLS } from './customer-wizard/wizardUi';

export function OrderFormExtraWorkConsentModal(props: {
  open: boolean;
  initialPhrase?: string | null;
  onClose: () => void;
  onConfirm: (payload: { at: string; typedPhrase: string }) => void;
}) {
  const { open, initialPhrase, onClose, onConfirm } = props;
  const scrollRef = useRef<HTMLDivElement>(null);
  const { onFieldFocus } = useModalScrollKeyboardAvoidance(scrollRef, open, 140);
  const [draft, setDraft] = useState('');
  const matched = draft.trim() === ORDER_FORM_EXTRA_WORK_CONSENT_PHRASE;

  useEffect(() => {
    if (!open) return;
    setDraft(initialPhrase?.trim() === ORDER_FORM_EXTRA_WORK_CONSENT_PHRASE ? ORDER_FORM_EXTRA_WORK_CONSENT_PHRASE : '');
  }, [initialPhrase, open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="modal-mobile-safe-overlay fixed inset-0 z-[1004] flex items-stretch justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="modal-mobile-fullscreen-panel relative flex h-[100dvh] w-full max-w-lg flex-col overflow-hidden bg-white shadow-2xl ring-1 ring-black/5 sm:h-auto sm:max-h-[min(92vh,40rem)] sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-extra-work-consent-title"
        onClick={(e) => e.stopPropagation()}
      >
        <ModalCloseButton onClick={onClose} />
        <div className="shrink-0 border-b border-slate-800 bg-slate-900 px-4 pb-4 pt-5 pr-14 text-white">
          <h2 id="order-extra-work-consent-title" className="text-fluid-base font-semibold tracking-tight">
            추가 시공비 안내
          </h2>
        </div>
        <div
          ref={scrollRef}
          className="modal-form-scroll-surface min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-4 sm:px-5"
          onFocusCapture={onFieldFocus}
        >
          <div className="space-y-3 text-fluid-sm leading-relaxed text-slate-800">
            <p>
              전달해 주신 내용과 현장 상황이 많이 다르면 별도의 추가 시공비가 발생합니다.
            </p>
            <p>
              더 정확한 견적을 원하시면 현장 사진이나 영상을 담당 영업사원에게 보내 문의해 주세요.
            </p>
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-fluid-xs font-medium leading-relaxed text-amber-950">
              별도의 추가시공이 발생할 수 있다는 내용을 확인하였고 이에 동의합니다.
            </p>
          </div>
          <label className="mt-4 block">
            <span className="text-fluid-xs font-medium text-slate-700">
              아래에 <span className="font-semibold text-slate-900">{ORDER_FORM_EXTRA_WORK_CONSENT_PHRASE}</span> 라고 적어 주세요.
            </span>
            <input
              className={`${WIZARD_INPUT_CLS} mt-2`}
              value={draft}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="done"
              onChange={(e) => setDraft(e.target.value)}
            />
          </label>
          <button
            type="button"
            className={`${WIZARD_CTA_CLS} mt-4`}
            disabled={!matched}
            onClick={() => {
              if (!matched) return;
              onConfirm({
                at: new Date().toISOString(),
                typedPhrase: ORDER_FORM_EXTRA_WORK_CONSENT_PHRASE,
              });
            }}
          >
            다음
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
