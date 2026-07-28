import { gaugeFillPercent, usageWarnLevel } from '../../utils/tenantUsageDisplay';

type Props = {
  label: string;
  used: number;
  limit: number | null;
  unit: string;
};

export function TenantUsageBar({ label, used, limit, unit }: Props) {
  const fillPercent = gaugeFillPercent(used, limit);
  const pct = fillPercent ?? 100;
  const level = usageWarnLevel(used, limit);

  return (
    <div className="min-w-0 space-y-1.5">
      <div className="flex min-w-0 items-center justify-between gap-2 text-[clamp(0.625rem,1.45vw,0.75rem)] leading-none">
        <span className="shrink-0 whitespace-nowrap font-semibold text-slate-500">{label}</span>
        <span className="shrink-0 whitespace-nowrap text-right font-bold tabular-nums text-slate-800">
          {used.toLocaleString()}
          {unit}
          {limit != null ? ` / ${limit.toLocaleString()}${unit}` : ' (무제한)'}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={[
            'h-full rounded-full transition-all duration-500',
            level === 'over' ? 'bg-rose-500' : level === 'warn' ? 'bg-amber-500' : 'bg-indigo-600',
          ].join(' ')}
          style={{ width: `${limit != null ? pct : 100}%` }}
        />
      </div>
      {limit != null && fillPercent != null ? (
        <p className="whitespace-nowrap text-[clamp(0.5625rem,1.2vw,0.625rem)] leading-none text-slate-400">
          {level === 'over' ? `${label} 한도를 초과했습니다.` : `한도 대비 ${Math.round(fillPercent)}% 사용 중`}
        </p>
      ) : null}
    </div>
  );
}
