import { createPortal } from 'react-dom';

/** PG가 연결되지 않은 업체에서 카드결재를 눌렀을 때. */
export function TeamCardPaymentPgRequiredDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/45 p-3 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="team-card-pg-required-title"
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <p id="team-card-pg-required-title" className="text-fluid-sm font-semibold text-slate-900">
          카드결재
        </p>
        <p className="mt-2 text-fluid-xs leading-snug text-slate-700">PG사 신청 후 사용 가능합니다.</p>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 flex min-h-10 w-full items-center justify-center rounded-lg bg-slate-900 text-fluid-xs font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
        >
          확인
        </button>
      </div>
    </div>,
    document.body,
  );
}
