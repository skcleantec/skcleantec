import { useCallback, useEffect, useState } from 'react';
import { fetchTenantSubscription, type TenantSubscriptionDto } from '../../api/tenantSubscription';
import { getToken } from '../../stores/auth';
import { usagePercent } from '@shared/tenantSubscriptionUsage';

export function DashboardTenantSubscriptionBlock() {
  const token = getToken();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<TenantSubscriptionDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setData(await fetchTenantSubscription(token));
    } catch (e) {
      setError(e instanceof Error ? e.message : '불러오기 실패');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!token) return null;

  if (loading) {
    return (
      <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm shadow-slate-100/50 flex items-center justify-center h-[180px]">
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500"></div>
          <span className="text-xs text-slate-400 font-medium">계정 상태 불러오는 중…</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm shadow-slate-100/50 flex items-center justify-center h-[180px]">
        <span className="text-xs text-rose-500 font-medium">가입 정보를 불러오지 못했습니다.</span>
      </div>
    );
  }

  const { tenant, usage } = data;

  // Find activeUsers usage row
  const userUsage = usage.find((u) => u.id === 'activeUsers') || {
    id: 'activeUsers',
    label: '활성 업무 계정',
    used: 0,
    limit: null,
    unit: '명',
  };

  const inquiriesUsage = usage.find((u) => u.id === 'inquiriesThisMonth') || {
    id: 'inquiriesThisMonth',
    label: '이번 달 접수',
    used: 0,
    limit: null,
    unit: '건',
  };

  const brandsUsage = usage.find((u) => u.id === 'operatingBrands') || {
    id: 'operatingBrands',
    label: '영업 브랜드',
    used: 0,
    limit: null,
    unit: '개',
  };

  // Calculate user percentage
  const userPct = usagePercent(userUsage.used, userUsage.limit);
  const isUserOver = userUsage.limit != null && userUsage.used > userUsage.limit;

  // SVG Radial Progress configuration
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const displayPct = userPct != null ? Math.min(100, userPct) : 100;
  const strokeDashoffset = circumference - (displayPct / 100) * circumference;

  // Status determination
  let statusText = '정상';
  let statusColorClass = 'text-emerald-500 bg-emerald-50 border-emerald-100';
  let dotColorClass = 'bg-emerald-500';
  let pulseColorClass = 'bg-emerald-400';

  if (isUserOver) {
    statusText = '초과';
    statusColorClass = 'text-rose-600 bg-rose-50 border-rose-100';
    dotColorClass = 'bg-rose-500';
    pulseColorClass = 'bg-rose-400';
  } else if (userPct != null && userPct >= 80) {
    statusText = '주의';
    statusColorClass = 'text-amber-600 bg-amber-50 border-amber-100';
    dotColorClass = 'bg-amber-500';
    pulseColorClass = 'bg-amber-400';
  }

  return (
    <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm shadow-slate-100/50 flex flex-col justify-between h-full min-h-[180px]">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <span className="text-sm font-semibold text-slate-800">계정 및 서비스 이용 현황</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 capitalize ring-1 ring-inset ring-slate-700/10">
            {tenant.planLabel}
          </span>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-semibold ${statusColorClass}`}>
            <span className="relative flex h-1.5 w-1.5">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${pulseColorClass}`}></span>
              <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${dotColorClass}`}></span>
            </span>
            {statusText}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6 flex-1">
        {/* Sleek Radial Graph for Active Users */}
        <div className="relative flex items-center justify-center shrink-0">
          <svg className="w-24 h-24 transform -rotate-90">
            {/* Background circle */}
            <circle
              cx="48"
              cy="48"
              r={radius}
              className="text-slate-100"
              strokeWidth="7"
              fill="transparent"
              stroke="currentColor"
            />
            {/* Foreground circle with glow */}
            <circle
              cx="48"
              cy="48"
              r={radius}
              className={isUserOver ? 'text-rose-500' : userPct != null && userPct >= 80 ? 'text-amber-500' : 'text-indigo-600'}
              strokeWidth="7"
              fill="transparent"
              stroke="currentColor"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 0.5s ease-in-out' }}
            />
          </svg>
          <div className="absolute flex flex-col items-center justify-center">
            <span className="text-base font-bold text-slate-800 tabular-nums leading-none">
              {userUsage.limit != null ? `${userUsage.used}/${userUsage.limit}` : userUsage.used}
            </span>
            <span className="text-[10px] text-slate-400 font-medium mt-1">
              {userUsage.limit != null ? `${userPct}%` : '무제한'}
            </span>
          </div>
        </div>

        {/* Status Panel / Progress Bars */}
        <div className="w-full sm:flex-1 space-y-3 min-w-0">
          {/* Active Users Details */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">활성 업무 계정</span>
            <span className="text-slate-800 font-semibold tabular-nums">
              {userUsage.used}명 {userUsage.limit != null ? `(정원 ${userUsage.limit}명)` : '(무제한)'}
            </span>
          </div>

          {/* Monthly Inquiries */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 font-medium">이번 달 접수량</span>
              <span className="text-slate-700 font-semibold tabular-nums">
                {inquiriesUsage.used.toLocaleString()}건
                {inquiriesUsage.limit != null ? ` / ${inquiriesUsage.limit.toLocaleString()}건` : ' (무제한)'}
              </span>
            </div>
            {inquiriesUsage.limit != null && (
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    usagePercent(inquiriesUsage.used, inquiriesUsage.limit) ?? 0 >= 100
                      ? 'bg-rose-500'
                      : (usagePercent(inquiriesUsage.used, inquiriesUsage.limit) ?? 0) >= 80
                      ? 'bg-amber-500'
                      : 'bg-indigo-500'
                  }`}
                  style={{ width: `${Math.min(100, usagePercent(inquiriesUsage.used, inquiriesUsage.limit) ?? 0)}%` }}
                />
              </div>
            )}
          </div>

          {/* Operating Brands */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-400 font-medium">활성 브랜드</span>
              <span className="text-slate-700 font-semibold tabular-nums">
                {brandsUsage.used}개
                {brandsUsage.limit != null ? ` / ${brandsUsage.limit}개` : ' (무제한)'}
              </span>
            </div>
            {brandsUsage.limit != null && (
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    usagePercent(brandsUsage.used, brandsUsage.limit) ?? 0 >= 100
                      ? 'bg-rose-500'
                      : (usagePercent(brandsUsage.used, brandsUsage.limit) ?? 0) >= 80
                      ? 'bg-amber-500'
                      : 'bg-indigo-500'
                  }`}
                  style={{ width: `${Math.min(100, usagePercent(brandsUsage.used, brandsUsage.limit) ?? 0)}%` }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
