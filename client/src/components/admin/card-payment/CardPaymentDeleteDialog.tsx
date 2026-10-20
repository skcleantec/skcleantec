import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useModalScrollKeyboardAvoidance } from '../../../hooks/useMobileInputVisibility';

export function CardPaymentDeleteDialog({
  open,
  customerName,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  open: boolean;
  customerName: string;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: (password: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { onFieldFocus } = useModalScrollKeyboardAvoidance(scrollRef, open);
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (!open) return;
    setPassword('');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, onClose, open]);

  if (!open) return null;

  return createPortal(
    <div className="modal-mobile-safe-overlay fixed inset-0 z-[80] flex items-end justify-center bg-black/40 sm:items-center">
      <div
        className="modal-mobile-fullscreen-panel flex max-h-[90vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:max-w-md sm:rounded-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="card-payment-delete-title"
      >
        <div
          ref={scrollRef}
          className="modal-form-scroll-surface min-h-0 flex-1 overflow-y-auto p-4"
          onFocusCapture={onFieldFocus}
        >
          <h2 id="card-payment-delete-title" className="text-fluid-sm font-semibold text-slate-900">
            결재 삭제
          </h2>
          <p className="mt-2 text-fluid-xs leading-snug text-slate-600">
            {customerName ? `${customerName} 결재 건을 지웁니다. ` : ''}
            결재완료와 취소 건은 지울 수 없습니다. 본인 비밀번호를 입력해 주세요.
          </p>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && password.trim() && !busy) onConfirm(password);
            }}
            className="login-field-input mt-3 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-fluid-sm"
            placeholder="비밀번호"
          />
          {error ? <p className="mt-2 text-fluid-xs text-red-700">{error}</p> : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-100 p-3">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-fluid-xs text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          >
            닫기
          </button>
          <button
            type="button"
            disabled={busy || !password.trim()}
            onClick={() => onConfirm(password)}
            className="min-h-10 rounded-lg bg-red-700 px-3 text-fluid-xs font-medium text-white hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
          >
            {busy ? '삭제 중…' : '삭제'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
