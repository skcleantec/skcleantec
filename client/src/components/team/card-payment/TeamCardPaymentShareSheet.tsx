import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { LineMdIcon } from '../../ui/LineMdIcon';
import { openPaymentKakao, openPaymentSms } from '../../../utils/cardPaymentShare';
import { copyTextToClipboard } from '../../../utils/clipboard';
import { TEAM_PAY_BTN } from './teamCardPaymentUi';

export function TeamCardPaymentShareSheet({
  open,
  phone,
  message,
  onClose,
}: {
  open: boolean;
  phone: string;
  message: string;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-900/40 p-3 sm:items-center">
      <button type="button" className="absolute inset-0" aria-label="닫기" onClick={onClose} />
      <div className="relative w-full max-w-md space-y-2 rounded-2xl bg-white p-3 shadow-xl">
        <div className="flex items-center justify-between">
          <p className="text-fluid-sm font-semibold text-slate-900">공유하기</p>
          <button
            type="button"
            className="flex size-9 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            onClick={onClose}
            aria-label="닫기"
          >
            <LineMdIcon name="close" className="size-5" />
          </button>
        </div>
        <button
          type="button"
          className={`${TEAM_PAY_BTN} bg-slate-900 text-white hover:bg-slate-800`}
          onClick={() => {
            openPaymentSms(phone, message);
            onClose();
          }}
        >
          <LineMdIcon name="phone" className="size-4" />
          문자
        </button>
        <button
          type="button"
          className={`${TEAM_PAY_BTN} border border-slate-300 bg-white text-slate-900 hover:bg-slate-50`}
          onClick={() => {
            void copyTextToClipboard(message).finally(() => {
              openPaymentKakao(message);
              onClose();
            });
          }}
        >
          카카오톡
        </button>
      </div>
    </div>,
    document.body,
  );
}
