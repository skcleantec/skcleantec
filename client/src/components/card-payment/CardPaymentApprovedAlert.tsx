import { useState } from 'react';
import { createPortal } from 'react-dom';
import { formatWon } from '@shared/cardPayment';
import {
  useCardPaymentApprovedRealtime,
  type CardPaymentApprovedPayload,
} from '../../hooks/useInboxRealtime';
import { Button } from '../ui/Button';
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
  const paidAt = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

  return createPortal(
    <div className="fixed inset-0 z-[140] flex items-end justify-center bg-slate-900/45 p-0 sm:items-center sm:p-4">
      <div
        className="w-full max-w-[390px] rounded-t-[20px] border border-slate-200 bg-white p-5 shadow-xl sm:rounded-[20px]"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="card-paid-title"
      >
        <div className="flex flex-col items-center text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-[#DCFCE7] text-[#15803D]">
            <LineMdIcon name="confirm" className="size-7" />
          </span>
          <p id="card-paid-title" className="mt-3 text-fluid-lg font-bold text-[#0F172A]">
            결제가 완료됐어요
          </p>
          <p
            className="mt-2 tabular-nums text-[#0F172A]"
            style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.2 }}
          >
            {formatWon(item.amountWon)}
          </p>
          <p className="mt-1 text-fluid-2xs text-slate-500">현장에서 철수하셔도 됩니다.</p>
        </div>

        <dl className="mt-5 grid grid-cols-[88px_1fr] gap-x-3 gap-y-2 rounded-[16px] bg-[#F4F6FA] px-3 py-3 text-fluid-xs">
          <dt className="text-slate-500">고객</dt>
          <dd className="text-right font-medium text-slate-900">{name}</dd>
          {item.inquiryNumber ? (
            <>
              <dt className="text-slate-500">접수번호</dt>
              <dd className="text-right tabular-nums text-slate-900">{item.inquiryNumber}</dd>
            </>
          ) : null}
          <dt className="text-slate-500">승인 일시</dt>
          <dd className="text-right tabular-nums text-slate-900">{paidAt}</dd>
        </dl>

        <div className="mt-4 grid gap-2">
          <Button
            type="button"
            variant="secondary"
            size="lg"
            className="h-[54px] w-full rounded-[14px]"
            onClick={() => {
              window.alert('카드사 영수증은 카드사 문자·앱에서 확인할 수 있어요.');
            }}
          >
            영수증 보기
          </Button>
          <Button type="button" variant="primary" size="lg" className="h-[54px] w-full rounded-[14px]" onClick={() => setItem(null)}>
            닫기
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
