import { createPortal } from 'react-dom';
import { LineMdIcon } from '../ui/LineMdIcon';

const CONFIRM_CLS =
  'w-full min-h-12 rounded-xl bg-slate-900 px-4 py-3 text-fluid-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

const REVIEW_CLS =
  'w-full min-h-12 rounded-xl border border-slate-200 bg-white px-4 py-3 text-fluid-sm font-medium text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

/** 서명으로 동의 직후 — 확인은 진행, 다시보기는 안내 처음으로 */
export function OrderFormGuideSignConfirmDialog(props: {
  open: boolean;
  onConfirm: () => void;
  onReview: () => void;
}) {
  const { open, onConfirm, onReview } = props;
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="modal-mobile-safe-overlay fixed inset-0 z-[1100] flex items-center justify-center bg-black/55 p-4"
      role="presentation"
      onClick={(e) => {
        e.stopPropagation();
        onReview();
      }}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-5 text-center shadow-2xl ring-1 ring-black/5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-guide-sign-confirm-title"
        onClick={(e) => e.stopPropagation()}
      >
        <LineMdIcon name="alert-circle" className="mx-auto size-10 text-red-600" />
        <h2
          id="order-guide-sign-confirm-title"
          className="mt-3 text-fluid-lg font-semibold leading-relaxed text-slate-900"
        >
          고객님은 <span className="text-red-600">안내사항</span>을 모두 읽고 숙지하셨으며, 계약이
          체결됩니다.
        </h2>
        <div className="mt-4 space-y-2">
          <button
            type="button"
            className={CONFIRM_CLS}
            onClick={(e) => {
              e.stopPropagation();
              onConfirm();
            }}
          >
            확인
          </button>
          <button
            type="button"
            className={REVIEW_CLS}
            onClick={(e) => {
              e.stopPropagation();
              onReview();
            }}
          >
            안내사항 다시보기
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
