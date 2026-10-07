import { useEffect, useState } from 'react';
import {
  computeCardPaymentFees,
  formatWon,
  type CardPaymentFeeBreakdown,
  type CardPaymentMethod,
} from '@shared/cardPayment';
import { LineMdIcon } from '../../ui/LineMdIcon';

export function TeamCardPaymentAmountStep({
  customerName,
  amount,
  onAmountChange,
  quote,
  onNext,
}: {
  customerName: string;
  amount: string;
  onAmountChange: (v: string) => void;
  quote: CardPaymentFeeBreakdown | null;
  onNext: () => void;
}) {
  const n = Math.round(Number(amount.replace(/[^\d]/g, '')) || 0);
  return (
    <div className="space-y-3">
      <p className="text-fluid-xs text-slate-600">
        고객 <span className="font-semibold text-slate-900">{customerName}</span>
      </p>
      <label className="block">
        <span className="text-fluid-2xs text-slate-500">결제 금액</span>
        <input
          inputMode="numeric"
          className="login-field-input mt-1 w-full min-h-11 rounded-xl border border-slate-200 px-3 text-fluid-sm tabular-nums"
          value={amount}
          onChange={(e) => onAmountChange(e.target.value.replace(/[^\d]/g, ''))}
        />
      </label>
      {quote ? (
        <p className="text-fluid-2xs text-slate-500">
          업체 수수료 {formatWon(quote.tenantFeeWon)} · 실수령 {formatWon(quote.tenantNetWon)}
        </p>
      ) : null}
      <button
        type="button"
        disabled={n < 100}
        onClick={onNext}
        className="flex min-h-11 w-full items-center justify-center gap-1 rounded-xl bg-slate-900 text-fluid-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
      >
        금액 확정
        <LineMdIcon name="arrow-right" className="size-4" />
      </button>
    </div>
  );
}

export function TeamCardPaymentMethodStep({
  onPick,
  busy,
}: {
  onPick: (method: CardPaymentMethod | 'PAY_WINDOW') => void;
  busy: boolean;
}) {
  return (
    <div className="grid gap-2">
      <p className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-fluid-2xs leading-snug text-slate-600">
        카드번호는 결제창에서만 입력합니다.
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => onPick('PAY_WINDOW')}
        className="flex min-h-12 flex-col items-center justify-center rounded-xl bg-slate-900 px-3 text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
      >
        <span className="text-fluid-sm font-semibold">결제창에서 결재</span>
        <span className="text-fluid-2xs font-normal text-slate-200">인증결제 · 카드번호는 그 창에 입력</span>
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => onPick('KEYIN')}
        className="flex min-h-12 flex-col items-center justify-center rounded-xl bg-slate-900 px-3 text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
      >
        <span className="text-fluid-sm font-semibold">수기결재 준비</span>
        <span className="text-fluid-2xs font-normal text-slate-200">카드번호는 이 화면에 입력하지 않음</span>
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => onPick('CUSTOMER_LINK')}
        className="flex min-h-12 flex-col items-center justify-center rounded-xl border border-slate-300 bg-white px-3 text-slate-800 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
      >
        <span className="text-fluid-sm font-semibold">고객에게 링크 발송</span>
        <span className="text-fluid-2xs font-normal text-slate-500">고객이 결제창에서 카드번호를 입력</span>
      </button>
    </div>
  );
}

export function TeamCardPaymentHostedResult({
  title,
  notice,
  windowUrl,
  onOpenWindow,
}: {
  title: string;
  notice: string | null;
  windowUrl: string;
  onOpenWindow: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-fluid-xs text-slate-700">{title}</p>
      {notice ? <p className="text-fluid-2xs text-amber-800">{notice}</p> : null}
      {windowUrl ? (
        <>
          <button
            type="button"
            onClick={onOpenWindow}
            className="flex min-h-11 w-full items-center justify-center gap-1 rounded-xl bg-slate-900 text-fluid-sm font-semibold text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none"
          >
            <LineMdIcon name="external-link" className="size-4" />
            결제창 다시 열기
          </button>
          <a
            href={windowUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-fluid-2xs text-sky-700 underline-offset-2 hover:underline"
          >
            창이 안 열리면 여기로 이동
          </a>
        </>
      ) : null}
    </div>
  );
}

export function useLiveQuote(amount: string, initial: CardPaymentFeeBreakdown | null) {
  const [quote, setQuote] = useState(initial);
  useEffect(() => {
    const n = Math.round(Number(amount) || 0);
    if (n <= 0) {
      setQuote(initial);
      return;
    }
    setQuote(computeCardPaymentFees(n, initial?.tenantFeeBps, initial?.platformCostBps));
  }, [amount, initial]);
  return quote;
}
