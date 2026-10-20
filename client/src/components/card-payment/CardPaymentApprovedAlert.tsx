import { useState } from 'react';
import { createPortal } from 'react-dom';
import { formatWon } from '@shared/cardPayment';
import {
  useCardPaymentApprovedRealtime,
  type CardPaymentApprovedPayload,
} from '../../hooks/useInboxRealtime';
import { LineMdIcon } from '../ui/LineMdIcon';

/** 인증결제 승인 직후, 팀장·관리자가 철수할 수 있게 화면 가운데 알림. */
export function CardPaymentApprovedAlert({
  token,
  enabled,
}: {
  token: string | null;
  enabled: boolean;
}) {
  const [item, setItem] = useState<CardPaymentApprovedPayload | null>(null);
  useCardPaymentApprovedRealtime(token, setItem, enabled && Boolean(token));
  if (!item) return null;
  const name = item.customerName.trim() || '고객';
  return createPortal(
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-slate-900/50 p-4">
      <div
        className="w-full max-w-sm rounded-2xl border border-emerald-200 bg-white p-4 shadow-xl"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="card-paid-title"
      >
        <div className="flex items-center gap-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
            <LineMdIcon name="confirm" className="size-5" />
          </span>
          <p id="card-paid-title" className="text-fluid-sm font-semibold text-slate-900">
            카드결재 완료
          </p>
        </div>
        <p className="mt-3 text-fluid-sm leading-relaxed text-slate-800">
          <span className="font-semibold">{name}</span> 고객님{' '}
          <span className="font-semibold tabular-nums">{formatWon(item.amountWon)}</span> 결제되었습니다.
        </p>
        {item.inquiryNumber ? (
          <p className="mt-1 text-fluid-2xs text-slate-500">접수번호 {item.inquiryNumber}</p>
        ) : null}
        <p className="mt-2 text-fluid-sm font-medium text-emerald-800">현장에서 철수하셔도 됩니다.</p>
        <button
          type="button"
          className="mt-4 flex min-h-11 w-full items-center justify-center rounded-xl bg-slate-900 text-fluid-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          onClick={() => setItem(null)}
        >
          확인
        </button>
      </div>
    </div>,
    document.body,
  );
}
