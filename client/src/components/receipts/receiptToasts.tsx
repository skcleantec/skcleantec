import type { ReactNode } from 'react';
import { toast, ToastButton } from '../ui/Toast';

/** 지갑 잔액 부족 문구면 충전 버튼을 붙인다. */
export function isWalletShortMessage(message: string | null | undefined): boolean {
  return /지갑.*잔액|잔액이 부족/.test(message ?? '');
}

export function showReceiptFailure(title: string, reason: string | null | undefined, onCharge?: () => void): void {
  const message = reason?.trim() || '알 수 없는 오류가 났어요. 잠시 후 다시 시도해 주세요.';
  const charge = onCharge && isWalletShortMessage(message);
  toast.error({
    title,
    body: message,
    actions: charge ? (
      <>
        <ToastButton>닫기</ToastButton>
        <ToastButton variant="primary" onClick={onCharge}>충전하기</ToastButton>
      </>
    ) : undefined,
  });
}

export function showReceiptDone(title: string, body?: ReactNode, actions?: ReactNode): void {
  toast.success({ title, body, actions, duration: actions ? 0 : 3500 });
}

/** 실패 칩: 누르면 실패 이유를 팝업으로 보여 준다. */
export function FailReasonChip({ label, reason, onCharge }: { label: string; reason: string | null | undefined; onCharge?: () => void }) {
  return (
    <button
      type="button"
      title={reason ?? undefined}
      className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-[#f3b8b1] bg-[#fdecea] px-1.5 py-0 text-fluid-2xs text-[#b42318] hover:bg-[#fbd9d5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
      onClick={() => showReceiptFailure('발급하지 못했어요', reason, onCharge)}
    >
      {label}
      <span aria-hidden className="inline-flex size-3.5 items-center justify-center rounded-full border border-current text-[9px] font-bold leading-none">?</span>
      <span className="sr-only">실패 이유 보기</span>
    </button>
  );
}
