import { createPortal } from 'react-dom';
import { ModalCloseButton } from '../admin/ModalCloseButton';

/** 발주서 목록 「발주서 새 창」과 같은 고객 화면을 접수 수정 안에서 연다. */
export function CustomerOrderFormPreviewModal(props: {
  open: boolean;
  onClose: () => void;
  url: string | null;
  customerName: string;
  submitted: boolean;
}) {
  const { open, onClose, url, customerName, submitted } = props;
  if (!open || !url || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="modal-mobile-safe-overlay fixed inset-0 z-[640] flex flex-col bg-black/45 p-0 sm:items-center sm:justify-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="modal-mobile-fullscreen-panel relative flex w-full flex-col overflow-hidden bg-white sm:max-h-[min(92vh,52rem)] sm:max-w-3xl sm:rounded-2xl sm:border sm:border-slate-200 sm:shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-order-preview-title"
        onClick={(e) => e.stopPropagation()}
      >
        <ModalCloseButton onClick={onClose} />
        <div className="shrink-0 border-b border-slate-100 px-4 pb-3 pt-4 pr-14">
          <h2 id="customer-order-preview-title" className="text-fluid-sm font-semibold text-slate-900">
            고객 발주서
          </h2>
          <p className="mt-0.5 truncate text-fluid-xs text-slate-600" title={customerName}>
            {customerName}
          </p>
          <p className="mt-1 text-fluid-2xs leading-snug text-slate-500">
            {submitted
              ? '고객이 제출한 발주서 화면입니다.'
              : '아직 제출 전입니다. 고객에게 보이는 화면 그대로입니다.'}
          </p>
        </div>
        <iframe
          title="고객 발주서"
          src={url}
          className="min-h-0 w-full flex-1 border-0 bg-slate-50"
        />
      </div>
    </div>,
    document.body,
  );
}
