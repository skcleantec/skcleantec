import { useState } from 'react';
import { openTenantWalletWindow } from '../../api/tenantBilling';

const BTN =
  'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

export function TenantWalletWindowButton({
  token,
  amountKrw,
  className = '',
}: {
  token: string;
  amountKrw: number;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!token || amountKrw <= 0) return null;

  return (
    <div className="space-y-1">
      <button
        type="button"
        className={`${BTN} ${className}`.trim()}
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setError(null);
          void openTenantWalletWindow(token, amountKrw)
            .then((result) => {
              window.location.assign(result.redirectUrl);
            })
            .catch((e: unknown) => {
              setError(e instanceof Error ? e.message : '결제창을 열지 못했습니다.');
              setBusy(false);
            });
        }}
      >
        {busy ? '결제창 여는 중' : `카드로 충전 ${amountKrw.toLocaleString('ko-KR')}원`}
      </button>
      <p className="text-xs text-gray-500">카드번호는 결제창에서 입력합니다. 승인되면 잔액에 바로 반영됩니다.</p>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
