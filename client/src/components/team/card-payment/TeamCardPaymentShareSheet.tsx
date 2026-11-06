import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { LineMdIcon } from '../../ui/LineMdIcon';
import { Button } from '../../ui/Button';
import { openPaymentKakao, openPaymentSms } from '../../../utils/cardPaymentShare';
import { copyTextToClipboard } from '../../../utils/clipboard';
import { TEAM_PAY_BTN_GHOST, TEAM_PAY_BTN_NAVY, TEAM_PAY_DIALOG, TEAM_PAY_OVERLAY } from './teamCardPaymentUi';

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
            <p id="team-card-share-title" className="text-fluid-sm font-semibold text-[#0F172A]">
              공유
            </p>
            <p className="mt-1 text-fluid-2xs leading-snug text-slate-500">문자·카카오톡으로 이어서 보냅니다.</p>
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
            className={TEAM_PAY_BTN_NAVY}
            onClick={() => {
              openPaymentSms(phone, message);
              onClose();
            }}
          >
            <LineMdIcon name="phone" className="size-4" />
            문자로 보내기
          </button>
          <button
            type="button"
            className={TEAM_PAY_BTN_GHOST}
            onClick={() => {
              void copyTextToClipboard(message).finally(() => {
                openPaymentKakao(message);
                onClose();
              });
            }}
          >
            카카오톡으로 보내기
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function TeamCardPaymentAlimtalkConfirm({
  open,
  previewText,
  maskedPhone,
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  previewText: string;
  maskedPhone: string;
  busy: boolean;
  onConfirm: () => void;
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
      <div className={TEAM_PAY_DIALOG} role="dialog" aria-modal="true" aria-labelledby="team-pay-alimtalk-title">
        <p id="team-pay-alimtalk-title" className="text-fluid-sm font-semibold text-[#0F172A]">
          알림톡 보내기 확인
        </p>
        <p className="mt-1 text-fluid-2xs text-slate-500">받는 번호 {maskedPhone}</p>
        <div className="mt-3 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-fluid-xs leading-relaxed whitespace-pre-wrap text-slate-800">
          {previewText}
        </div>
        <div className="mt-4 grid gap-2">
          <Button type="button" variant="primary" size="lg" disabled={busy} className="w-full" onClick={onConfirm}>
            {busy ? '보내는 중…' : '보내기'}
          </Button>
          <Button type="button" variant="secondary" size="lg" disabled={busy} className="w-full" onClick={onClose}>
            취소
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function usePayCelebrate() {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate?.([80, 40, 80]);
      }
    } catch {
      /* ignore */
    }
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 880;
      gain.gain.value = 0.04;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      window.setTimeout(() => {
        osc.stop();
        void ctx.close();
      }, 180);
    } catch {
      /* ignore */
    }
    setArmed(false);
  }, [armed]);
  return useCallback(() => setArmed(true), []);
}
