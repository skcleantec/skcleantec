import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ModalCloseButton } from '../admin/ModalCloseButton';
import {
  ORDER_FORM_STAFF_VIEW_CLOSE,
  withOrderFormStaffView,
} from '../../utils/orderFormStaffView';

/** 발주서 목록 「발주서 새 창」과 같은 고객 화면을 접수 수정 안에서 연다. 제출·메일은 막는다. */
export function CustomerOrderFormPreviewModal(props: {
  open: boolean;
  onClose: () => void;
  url: string | null;
  customerName: string;
  submitted: boolean;
  /** 팀장 현장 확인 등, 기본 안내 대신 쓸 한 줄 */
  note?: string;
}) {
  const { open, onClose, url, customerName, submitted, note } = props;

  useEffect(() => {
    if (!open) return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string } | null;
      if (data?.type !== ORDER_FORM_STAFF_VIEW_CLOSE) return;
      onClose();
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [open, onClose]);

  if (!open || !url || typeof document === 'undefined') return null;

  const src = withOrderFormStaffView(url);

  return createPortal(
    <div
      className="modal-mobile-safe-overlay fixed inset-0 z-[640] flex flex-col bg-black/45 p-0 sm:items-center sm:justify-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="modal-mobile-fullscreen-panel relative flex h-[100dvh] w-full flex-col overflow-hidden bg-white sm:h-[min(92vh,52rem)] sm:max-h-[min(92vh,52rem)] sm:max-w-3xl sm:rounded-2xl sm:border sm:border-slate-200 sm:shadow-xl"
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
            {note ??
              (submitted
                ? '고객이 제출한 발주서 화면입니다. 여기서는 메일을 다시 보내지 않습니다.'
                : '아직 제출 전입니다. 고객 화면을 보기만 하며, 여기서는 제출되지 않습니다.')}
          </p>
        </div>
        <iframe
          title="고객 발주서"
          src={src}
          className="min-h-0 w-full flex-1 border-0 bg-slate-50"
        />
      </div>
    </div>,
    document.body,
  );
}
