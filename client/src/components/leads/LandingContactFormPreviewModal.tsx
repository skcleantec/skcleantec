import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { LandingContactCustomFieldDef } from '@shared/landingContactForm';
import { resolveLandingContactPublicTitle } from '@shared/landingContactForm';
import { useModalScrollKeyboardAvoidance } from '../../hooks/useMobileInputVisibility';
import { LandingContactChoiceField } from './LandingContactChoiceField';

const inputCls =
  'w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-fluid-sm text-slate-900';

export function LandingContactFormPreviewModal(props: {
  open: boolean;
  title: string | null;
  introText: string | null;
  fields: LandingContactCustomFieldDef[];
  onClose: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { onFieldFocus } = useModalScrollKeyboardAvoidance(scrollRef, props.open);
  const heading = resolveLandingContactPublicTitle(props.title);

  useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') props.onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props.open, props.onClose]);

  if (!props.open) return null;

  return createPortal(
    <div className="modal-mobile-safe-overlay fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4">
      <div className="modal-mobile-fullscreen-panel flex max-h-[100dvh] w-full max-w-lg flex-col overflow-hidden bg-slate-100 sm:max-h-[90vh] sm:rounded-2xl">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2">
          <div className="min-w-0">
            <p className="text-fluid-2xs text-slate-500">미리보기</p>
            <p className="truncate text-fluid-sm font-semibold text-slate-900">{heading}</p>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-lg px-3 py-2 text-fluid-xs font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          >
            닫기
          </button>
        </div>
        <div
          ref={scrollRef}
          onFocusCapture={onFieldFocus}
          className="modal-form-scroll-surface min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3"
        >
          {props.introText?.trim() ? (
            <p className="text-fluid-xs leading-relaxed text-slate-600">{props.introText.trim()}</p>
          ) : null}
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-fluid-2xs text-amber-900">
            저장 전 화면입니다. 여기서는 접수되지 않습니다.
          </p>
          <label className="block text-fluid-xs font-medium text-slate-700">
            성함 <span className="text-red-600">*</span>
            <input className={`${inputCls} mt-1`} placeholder="홍길동" readOnly />
          </label>
          <label className="block text-fluid-xs font-medium text-slate-700">
            연락처 <span className="text-red-600">*</span>
            <input className={`${inputCls} mt-1`} placeholder="010-0000-0000" readOnly />
          </label>
          {props.fields
            .filter((field) => field.label.trim())
            .map((field) => (
              <div key={field.key || field.label}>
                <p className="mb-1 text-fluid-xs font-medium text-slate-700">
                  {field.label}
                  {field.required ? <span className="text-red-600"> *</span> : null}
                </p>
                {field.type === 'select' ? (
                  <LandingContactChoiceField field={field} value="" onChange={() => undefined} className={inputCls} />
                ) : field.type === 'textarea' ? (
                  <textarea className={`${inputCls} min-h-[96px]`} readOnly placeholder={field.placeholder ?? field.label} />
                ) : (
                  <input className={inputCls} readOnly placeholder={field.placeholder ?? field.label} />
                )}
              </div>
            ))}
          <label className="block text-fluid-xs font-medium text-slate-700">
            문의 내용 <span className="text-red-600">*</span>
            <textarea className={`${inputCls} mt-1 min-h-[96px]`} readOnly placeholder="희망 일정, 특이사항" />
          </label>
          <button
            type="button"
            disabled
            className="w-full min-h-10 rounded-lg bg-slate-900 py-2 text-fluid-xs font-semibold text-white disabled:pointer-events-none disabled:opacity-50"
          >
            문의 접수하기
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
