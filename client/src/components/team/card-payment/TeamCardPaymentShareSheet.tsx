import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { LineMdIcon } from '../../ui/LineMdIcon';
import { openPaymentKakao, openPaymentSms } from '../../../utils/cardPaymentShare';
import { copyTextToClipboard } from '../../../utils/clipboard';
import { TEAM_PAY_BTN, TEAM_PAY_DIALOG, TEAM_PAY_OVERLAY } from './teamCardPaymentUi';

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
    <div className={TEAM_PAY_OVERLAY}>
      <button type="button" className="absolute inset-0" aria-label="닫기" onClick={onClose} />
      <div className={TEAM_PAY_DIALOG} role="dialog" aria-modal="true" aria-labelledby="team-card-share-title">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p id="team-card-share-title" className="text-fluid-sm font-semibold text-slate-900">
              공유하기
            </p>
            <p className="mt-1 text-fluid-2xs leading-snug text-slate-500">보낼 앱을 고르면 그 화면으로 이동합니다.</p>
          </div>
          <button
            type="button"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            onClick={onClose}
            aria-label="닫기"
          >
            <LineMdIcon name="close" className="size-5" />
          </button>
        </div>
        <div className="mt-4 grid gap-2">
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
      </div>
    </div>,
    document.body,
  );
}
