import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { extraWorkNoticeCopy, type ExtraWorkNoticeCopy } from '@shared/orderFormCustomerPages';
import { ORDER_FORM_EXTRA_WORK_CONSENT_PHRASE } from '@shared/orderFormConsents';
import { useModalScrollKeyboardAvoidance } from '../../hooks/useMobileInputVisibility';
import { LineMdIcon } from '../ui/LineMdIcon';
import { ModalCloseButton } from '../admin/ModalCloseButton';
import { WIZARD_CTA_CLS } from './customer-wizard/wizardUi';

function emphasizeCost(text: string) {
  const phrase = text.includes('별도의 추가 시공비') ? '별도의 추가 시공비' : '추가 시공비';
  const at = text.indexOf(phrase);
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <span className="text-red-700">{phrase}</span>
      {text.slice(at + phrase.length)}
    </>
  );
}

export function OrderFormExtraWorkConsentModal(props: {
  open: boolean;
  initialPhrase?: string | null;
  copy?: ExtraWorkNoticeCopy | null;
  onClose: () => void;
  onConfirm: (payload: { at: string; typedPhrase: string }) => void;
}) {
  const { open, initialPhrase, onClose, onConfirm } = props;
  const copy = props.copy ?? extraWorkNoticeCopy(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { onFieldFocus } = useModalScrollKeyboardAvoidance(scrollRef, open, 160);
  const [draft, setDraft] = useState('');
  const matched = draft.trim() === ORDER_FORM_EXTRA_WORK_CONSENT_PHRASE;

  useEffect(() => {
    if (!open) return;
    setDraft(initialPhrase?.trim() === ORDER_FORM_EXTRA_WORK_CONSENT_PHRASE ? ORDER_FORM_EXTRA_WORK_CONSENT_PHRASE : '');
  }, [initialPhrase, open]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="modal-mobile-safe-overlay fixed inset-0 z-[1004] flex items-stretch justify-center bg-black/55 p-0 sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="modal-mobile-fullscreen-panel relative flex h-[100dvh] w-full max-w-lg flex-col overflow-hidden bg-white shadow-2xl ring-1 ring-red-900/10 sm:h-auto sm:max-h-[min(92vh,44rem)] sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-extra-work-consent-title"
        onClick={(e) => e.stopPropagation()}
      >
        <ModalCloseButton onClick={onClose} />
        <div className="shrink-0 border-b border-red-800 bg-red-700 px-4 pb-4 pt-5 pr-14 text-white">
          <div className="flex items-center gap-2">
            <LineMdIcon name="alert-circle" className="size-7 text-white" />
            <h2 id="order-extra-work-consent-title" className="text-fluid-lg font-bold tracking-tight">
              {copy.title}
            </h2>
          </div>
          <p className="mt-1.5 text-fluid-sm font-medium leading-snug text-red-50">{copy.subtitle}</p>
        </div>
        <div
          ref={scrollRef}
          className="modal-form-scroll-surface min-h-0 flex-1 overflow-y-auto overscroll-y-contain bg-amber-50/40 px-4 py-4 sm:px-5"
          onFocusCapture={onFieldFocus}
        >
          <p className="text-fluid-base font-bold leading-snug text-slate-900">{emphasizeCost(copy.body)}</p>

          <div className="mt-4 rounded-2xl border-2 border-red-200 bg-white px-3 py-3 shadow-sm">
            <p className="text-fluid-sm font-bold text-red-800">{copy.casesTitle}</p>
            <ul className="mt-2.5 flex flex-wrap gap-1.5">
              {copy.cases.map((item) => (
                <li
                  key={item}
                  className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-fluid-sm font-semibold leading-snug text-red-950"
                >
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-3 rounded-xl bg-amber-100 px-3 py-2.5 text-fluid-sm font-semibold leading-relaxed text-amber-950">
              {copy.callout}
            </p>
          </div>

          <p className="mt-4 text-fluid-sm leading-relaxed text-slate-700">{copy.photoHint}</p>

          <p className="mt-4 rounded-xl border-2 border-red-300 bg-red-50 px-3 py-3 text-fluid-base font-bold leading-relaxed text-red-950">
            {copy.consent}
          </p>

          <label className="mt-4 block">
            <span className="text-fluid-sm font-semibold text-slate-900">
              아래에{' '}
              <span className="rounded-md bg-red-700 px-1.5 py-0.5 text-white">
                {ORDER_FORM_EXTRA_WORK_CONSENT_PHRASE}
              </span>
              {' '}라고 적어 주세요.
            </span>
            <input
              className="mt-2 w-full min-h-12 rounded-xl border-2 border-red-300 bg-white px-3 py-2.5 text-fluid-base font-semibold text-slate-900 focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/25"
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
