import { formatWon } from '@shared/cardPayment';

export function CardPaymentFeeSummary({
  approvedCount,
  amountWon,
  tenantFeeWon,
  platformSpreadWon,
  tenantNetWon,
}: {
  approvedCount: number;
  amountWon: number;
  tenantFeeWon: number;
  platformSpreadWon: number;
  tenantNetWon: number;
}) {
  const cells = [
    { label: '완료 건수', value: `${approvedCount.toLocaleString('ko-KR')}건` },
    { label: '결제 합계', value: formatWon(amountWon) },
    { label: '업체 수수료(3.3%)', value: formatWon(tenantFeeWon) },
    { label: '업체 실수령', value: formatWon(tenantNetWon) },
    { label: '플랫폼 차액', value: formatWon(platformSpreadWon) },
  ];
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {cells.map((c) => (
        <div key={c.label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-fluid-2xs text-slate-500">{c.label}</p>
          <p className="mt-0.5 text-fluid-sm font-semibold tabular-nums text-slate-900">{c.value}</p>
        </div>
      ))}
    </div>
  );
}
