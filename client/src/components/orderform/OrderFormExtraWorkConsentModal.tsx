import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ORDER_FORM_EXTRA_WORK_CONSENT_PHRASE } from '@shared/orderFormConsents';
import { useModalScrollKeyboardAvoidance } from '../../hooks/useMobileInputVisibility';
import { LineMdIcon } from '../ui/LineMdIcon';
import { ModalCloseButton } from '../admin/ModalCloseButton';
import { WIZARD_CTA_CLS } from './customer-wizard/wizardUi';

const EXTRA_WORK_CASES = [
  '면적이 넓은 곰팡이',
  '스티커 제거',
  '분진',
  '외창',
  '가전',
  '추가 가구',
  '입주 기본청소가 아닌 경우',
] as const;

export function OrderFormExtraWorkConsentModal(props: {
  open: boolean;
  initialPhrase?: string | null;
  onClose: () => void;
  onConfirm: (payload: { at: string; typedPhrase: string }) => void;
}) {
  const { open, initialPhrase, onClose, onConfirm } = props;
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
              추가 시공비 안내
            </h2>
          </div>
          <p className="mt-1.5 text-fluid-sm font-medium leading-snug text-red-50">
            현장 상황이 다르면 비용이 더 붙을 수 있습니다.
          </p>
        </div>
        <div
          ref={scrollRef}
          className="modal-form-scroll-surface min-h-0 flex-1 overflow-y-auto overscroll-y-contain bg-amber-50/40 px-4 py-4 sm:px-5"
          onFocusCapture={onFieldFocus}
        >
          <p className="text-fluid-base font-bold leading-snug text-slate-900">
            전달해 주신 내용과 현장 상황이 많이 다르면{' '}
            <span className="text-red-700">별도의 추가 시공비</span>가 발생합니다.
          </p>

          <div className="mt-4 rounded-2xl border-2 border-red-200 bg-white px-3 py-3 shadow-sm">
            <p className="text-fluid-sm font-bold text-red-800">이런 경우에 추가 시공비가 생깁니다</p>
            <ul className="mt-2.5 flex flex-wrap gap-1.5">
              {EXTRA_WORK_CASES.map((item) => (
                <li
                  key={item}
                  className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-fluid-sm font-semibold leading-snug text-red-950"
                >
                  {item}
                </li>
              ))}
            </ul>
            <p className="mt-3 rounded-xl bg-amber-100 px-3 py-2.5 text-fluid-sm font-semibold leading-relaxed text-amber-950">
              추가 인력과 약품, 장비가 투입되어야 하는 경우에도 발생합니다.
            </p>
          </div>

          <p className="mt-4 text-fluid-sm leading-relaxed text-slate-700">
            더 정확한 견적을 원하시면 현장 사진이나 영상을 담당 영업사원에게 보내 문의해 주세요.
          </p>

          <p className="mt-4 rounded-xl border-2 border-red-300 bg-red-50 px-3 py-3 text-fluid-base font-bold leading-relaxed text-red-950">
            별도의 추가시공이 발생할 수 있다는 내용을 확인하였고 이에 동의합니다.
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
