import { gaugeFillPercent, gaugeNeedleRotateDeg, usageWarnLevel } from '../../utils/tenantUsageDisplay';

const ARC_LENGTH = 125.66;

type Props = {
  used: number;
  limit: number | null;
  unit: string;
  label?: string;
  unlimited?: boolean;
};

export function TenantUsageGauge({ used, limit, unit, label = '이용 코인', unlimited }: Props) {
  const isUnlimited = unlimited ?? limit == null;
  const fillPercent = isUnlimited ? null : gaugeFillPercent(used, limit);
  const displayPct = fillPercent ?? 0;
  const level = usageWarnLevel(used, isUnlimited ? null : limit);

  let gaugeColor = '#6366f1';
  if (level === 'over') gaugeColor = '#f43f5e';
  else if (level === 'warn') gaugeColor = '#f59e0b';

  const needleRotate = gaugeNeedleRotateDeg(displayPct);
  const arcOffset = ARC_LENGTH - (displayPct / 100) * ARC_LENGTH;

  return (
    <div className="flex shrink-0 flex-col items-center" aria-label={`${label} ${used.toLocaleString()}${unit}`}>
      <div className="relative flex items-center justify-center">
        <svg viewBox="0 0 100 60" className="h-20 w-32 overflow-visible" aria-hidden>
          <path
            d="M 10 50 A 40 40 0 0 1 90 50"
            fill="none"
            stroke="#f1f5f9"
            strokeWidth="8"
            strokeLinecap="round"
          />
          {!isUnlimited ? (
            <path
              d="M 10 50 A 40 40 0 0 1 90 50"
              fill="none"
              stroke={gaugeColor}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={ARC_LENGTH}
              strokeDashoffset={arcOffset}
              style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
            />
          ) : (
            <path
              d="M 10 50 A 40 40 0 0 1 90 50"
              fill="none"
              stroke="#6366f1"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={ARC_LENGTH}
              strokeDashoffset={0}
              opacity={0.35}
            />
          )}
          {[0, 25, 50, 75, 100].map((p) => (
            <line
              key={p}
              x1="50"
              y1="10"
              x2="50"
              y2="14"
              stroke="#cbd5e1"
              strokeWidth="1.5"
              transform={`rotate(${gaugeNeedleRotateDeg(p)}, 50, 50)`}
            />
          ))}
          {!isUnlimited ? (
            <g
              transform={`rotate(${needleRotate}, 50, 50)`}
              style={{ transition: 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
            >
              <path d="M 48.5 50 L 50 11 L 51.5 50 Z" fill="#f43f5e" />
              <circle cx="50" cy="50" r="4" fill="#f43f5e" />
            </g>
          ) : null}
          <circle cx="50" cy="50" r="2.5" fill="#1e293b" />
          <circle cx="50" cy="50" r="1" fill="#94a3b8" />
        </svg>
      </div>
      <div className="-mt-2 text-center">
        <span className="block text-sm font-extrabold tabular-nums leading-none text-slate-800">
          {isUnlimited ? '무제한' : `${used.toLocaleString()}${unit}`}
        </span>
        <span className="mt-1 block text-[10px] font-medium text-slate-400">
          {isUnlimited
            ? label
            : limit != null
              ? `${label} · 한도 ${limit.toLocaleString()}${unit}`
              : label}
        </span>
        {!isUnlimited && fillPercent != null ? (
          <span className="mt-0.5 block text-[10px] tabular-nums text-slate-500">
            {level === 'over' ? '포함량 초과' : `${fillPercent}% 사용`}
          </span>
        ) : null}
      </div>
    </div>
  );
}
