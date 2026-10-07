import { useState } from 'react';
import { cancelUsageFeeCardPayment, type UsageFeeCardPaymentRow } from '../../api/platformCardPayment';

const BTN =
  'inline-flex min-h-9 items-center justify-center rounded-lg border border-red-200 bg-white px-2.5 text-xs font-medium text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

export function UsageFeeSameDayCancelButton({
  row,
  onDone,
}: {
  row: UsageFeeCardPaymentRow;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  if (!row.cancelable) return <span className="text-gray-400">—</span>;

  if (row.payMethod === 'KEYIN') {
    return (
      <a href="https://wspay.net" target="_blank" rel="noreferrer" className={BTN} title="수기 승인은 판매자센터에서 당일 전액 취소합니다.">
        전액 취소
      </a>
    );
  }

  return (
    <button
      type="button"
      className={BTN}
      disabled={busy}
      onClick={() => {
        const ok = window.confirm(`${row.amountKrw.toLocaleString('ko-KR')}원 전액을 취소합니다. 부분 환불은 되지 않습니다.`);
        if (!ok) return;
        setBusy(true);
        void cancelUsageFeeCardPayment(row.id)
          .then(() => onDone())
          .catch((e: unknown) => window.alert(e instanceof Error ? e.message : '전액 취소를 하지 못했습니다.'))
          .finally(() => setBusy(false));
      }}
    >
      {busy ? '취소 중' : '전액 취소'}
    </button>
  );
}
