import type { TenantSubscriptionDto } from '../../api/tenantSubscription';
import { usagePercent } from '@shared/tenantSubscriptionUsage';

type UsageRow = TenantSubscriptionDto['usage'][number];

function pickUsage(usage: UsageRow[] | undefined, id: UsageRow['id'], fallback: UsageRow): UsageRow {
  return usage?.find((u) => u.id === id) ?? fallback;
}

function UsageBar({
  label,
  used,
  limit,
  unit,
}: {
  label: string;
  used: number;
  limit: number | null;
  unit: string;
}) {
  const pct = limit != null ? Math.min(100, Math.round((used / limit) * 100)) : 100;
  const over = limit != null && used > limit;
  const warn = limit != null && !over && pct >= 80;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500 font-semibold">{label}</span>
        <span className="text-slate-800 font-bold tabular-nums">
          {used.toLocaleString()}
          {unit}
          {limit != null ? ` / ${limit.toLocaleString()}${unit}` : ' (무제한)'}
        </span>
      </div>
      <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            over ? 'bg-rose-500' : warn ? 'bg-amber-500' : 'bg-indigo-600'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {limit != null ? (
        <p className="text-[10px] text-slate-400">
          {over ? `${label} 한도를 초과했습니다.` : `한도 대비 ${pct}% 사용 중`}
        </p>
      ) : null}
    </div>
  );
}

function InquirySpeedometer({
  used,
  limit,
}: {
  used: number;
  limit: number | null;
}) {
  const pct = usagePercent(used, limit);
  const isOver = limit != null && used > limit;
  const visualLimit =
    limit !== null ? limit : used > 0 ? Math.ceil((used * 1.5) / 10) * 10 : 100;
  const displayPct =
    visualLimit > 0 ? Math.min(100, Math.round((used / visualLimit) * 100)) : 0;

  let gaugeColor = '#6366f1';
  if (isOver) gaugeColor = '#f43f5e';
  else if (limit != null && (pct ?? 0) >= 80) gaugeColor = '#f59e0b';

  const arcLength = 125.66;
  const needleAngle = -180 + displayPct * 1.8;

  return (
    <div className="flex flex-col items-center shrink-0">
      <div className="relative flex items-center justify-center">
        <svg viewBox="0 0 100 60" className="w-32 h-20 overflow-visible" aria-hidden>
          <path
            d="M 10 50 A 40 40 0 0 1 90 50"
            fill="none"
            stroke="#f1f5f9"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path
            d="M 10 50 A 40 40 0 0 1 90 50"
            fill="none"
            stroke={gaugeColor}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={arcLength}
            strokeDashoffset={arcLength - (displayPct / 100) * arcLength}
            style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
          />
          {[0, 25, 50, 75, 100].map((p) => (
            <line
              key={p}
              x1="50"
              y1="10"
              x2="50"
              y2="14"
              stroke="#cbd5e1"
              strokeWidth="1.5"
              transform={`rotate(${-180 + p * 1.8}, 50, 50)`}
            />
          ))}
          <g
            transform={`rotate(${needleAngle}, 50, 50)`}
            style={{ transition: 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
          >
            <path d="M 48.5 50 L 50 11 L 51.5 50 Z" fill="#f43f5e" />
            <circle cx="50" cy="50" r="4" fill="#f43f5e" />
          </g>
          <circle cx="50" cy="50" r="2.5" fill="#1e293b" />
          <circle cx="50" cy="50" r="1" fill="#94a3b8" />
        </svg>
      </div>
      <div className="text-center -mt-2">
        <span className="text-sm font-extrabold text-slate-800 block leading-none tabular-nums">
          {used.toLocaleString()}건
        </span>
        <span className="text-[10px] text-slate-400 font-medium mt-1 block">
          {limit !== null ? `한도 ${limit.toLocaleString()}건` : '무제한'}
        </span>
      </div>
    </div>
  );
}

export function DashboardTenantSubscriptionView({ data }: { data: TenantSubscriptionDto }) {
  const { tenant, usage } = data;

  const userUsage = pickUsage(usage, 'activeUsers', {
    id: 'activeUsers',
    label: '활성 업무 계정',
    used: 0,
    limit: null,
    unit: '명',
  });
  const inquiriesUsage = pickUsage(usage, 'inquiriesThisMonth', {
    id: 'inquiriesThisMonth',
    label: '이번 달 접수',
    used: 0,
    limit: null,
    unit: '건',
  });
  const brandsUsage = pickUsage(usage, 'operatingBrands', {
    id: 'operatingBrands',
    label: '영업 브랜드',
    used: 0,
    limit: null,
    unit: '개',
  });

  const userPct = usagePercent(userUsage.used, userUsage.limit);
  const inquiriesPct = usagePercent(inquiriesUsage.used, inquiriesUsage.limit) ?? 0;
  const isUserOver = userUsage.limit != null && userUsage.used > userUsage.limit;
  const isInquiriesOver = inquiriesUsage.limit != null && inquiriesUsage.used > inquiriesUsage.limit;
  const isOver = isUserOver || isInquiriesOver;
  const isWarning =
    (userPct != null && userPct >= 80) ||
    (inquiriesUsage.limit != null && inquiriesPct >= 80);

  let statusText = '정상';
  let statusColorClass = 'text-emerald-500 bg-emerald-50 border-emerald-100';
  let dotColorClass = 'bg-emerald-500';
  let pulseColorClass = 'bg-emerald-400';

  if (isOver) {
    statusText = '초과';
    statusColorClass = 'text-rose-600 bg-rose-50 border-rose-100';
    dotColorClass = 'bg-rose-500';
    pulseColorClass = 'bg-rose-400';
  } else if (isWarning) {
    statusText = '주의';
    statusColorClass = 'text-amber-600 bg-amber-50 border-amber-100';
    dotColorClass = 'bg-amber-500';
    pulseColorClass = 'bg-amber-400';
  }

  return (
    <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm shadow-slate-100/50 flex flex-col justify-between h-full min-h-[180px]">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          <span className="text-sm font-semibold text-slate-800">계정 및 서비스 이용 현황</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 capitalize ring-1 ring-inset ring-slate-700/10">
            {tenant.planLabel}
          </span>
          <span
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-semibold ${statusColorClass}`}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${pulseColorClass}`}
              />
              <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${dotColorClass}`} />
            </span>
            {statusText}
          </span>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8 flex-1">
        <InquirySpeedometer used={inquiriesUsage.used} limit={inquiriesUsage.limit} />

        <div className="w-full sm:flex-1 space-y-4 min-w-0">
          <UsageBar
            label="활성 업무 계정"
            used={userUsage.used}
            limit={userUsage.limit}
            unit="명"
          />
          <UsageBar
            label="활성 브랜드"
            used={brandsUsage.used}
            limit={brandsUsage.limit}
            unit="개"
          />
        </div>
      </div>
    </div>
  );
}
