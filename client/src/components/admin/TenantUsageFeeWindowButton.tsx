import { useState } from 'react';
import { openTenantUsageFeeWindow } from '../../api/tenantBilling';
import { usageFeeChargeKrw, usageFeeVatKrw } from '@shared/tenantBilling';

const BTN =
  'rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';

export function TenantUsageFeeWindowButton({
  token,
  periodStart,
  supplyKrw,
  className = '',
}: {
  token: string;
  periodStart: string;
  supplyKrw: number;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const vat = usageFeeVatKrw(supplyKrw);
  const charge = usageFeeChargeKrw(supplyKrw);
  if (supplyKrw <= 0) return null;

  return (
    <div className="space-y-1">
      <button
        type="button"
        className={`${BTN} ${className}`.trim()}
        disabled={busy}
        onClick={() => {
          setBusy(true);
          setError(null);
          void openTenantUsageFeeWindow(token, periodStart)
            .then((result) => {
              window.location.assign(result.redirectUrl);
            })
            .catch((e: unknown) => {
              setError(e instanceof Error ? e.message : '결제창을 열지 못했습니다.');
              setBusy(false);
            });
        }}
      >
        {busy ? '결제창 여는 중' : `카드로 결제 ${charge.toLocaleString('ko-KR')}원`}
      </button>
      <p className="text-xs text-gray-500">
        이용료 {supplyKrw.toLocaleString('ko-KR')}원 + 부가세 {vat.toLocaleString('ko-KR')}원. 카드번호는 결제창에서 입력합니다.
      </p>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
