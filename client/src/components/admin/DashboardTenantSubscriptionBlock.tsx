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

  // Find usage rows
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

  // Calculate percentages
  const userPct = usagePercent(userUsage.used, userUsage.limit);
  const isUserOver = userUsage.limit != null && userUsage.used > userUsage.limit;

  const inquiriesPct = usagePercent(inquiriesUsage.used, inquiriesUsage.limit) ?? 0;
  const isInquiriesOver = inquiriesUsage.limit != null && inquiriesUsage.used > inquiriesUsage.limit;

  const brandsPct = brandsUsage.limit != null ? Math.round((brandsUsage.used / brandsUsage.limit) * 100) : 100;
  const isBrandsOver = brandsUsage.limit != null && brandsUsage.used > brandsUsage.limit;

  // Calculate dynamic visual limit for inquiries if unlimited
  const visualInquiriesLimit = inquiriesUsage.limit !== null
    ? inquiriesUsage.limit
    : (inquiriesUsage.used > 0 ? Math.ceil(inquiriesUsage.used * 1.5 / 10) * 10 : 100);

  const displayInquiriesPct = Math.round((inquiriesUsage.used / visualInquiriesLimit) * 100);

  // Overall status determination
  const isOver = isUserOver || isInquiriesOver;
  const isWarning = (userPct != null && userPct >= 80) || (inquiriesUsage.limit != null && inquiriesPct >= 80);

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

  // Speedometer color determination
  let gaugeColor = '#6366f1'; // indigo-500 (default/normal)
  if (isInquiriesOver) {
    gaugeColor = '#f43f5e'; // rose-500
  } else if (inquiriesUsage.limit != null && inquiriesPct >= 80) {
    gaugeColor = '#f59e0b'; // amber-500
  }

  // SVG Arc configuration
  const arcLength = 125.66; // Math.PI * 40

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
      <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8 flex-1">
        {/* Sleek Speedometer Car Gauge for Inquiries */}
        <div className="flex flex-col items-center shrink-0">
          <div className="relative flex items-center justify-center">
            <svg viewBox="0 0 100 60" className="w-32 h-20 overflow-visible">
              {/* Background Track Arc */}
              <path
                d="M 10 50 A 40 40 0 0 1 90 50"
                fill="none"
                stroke="#f1f5f9"
                strokeWidth="8"
                strokeLinecap="round"
              />
              
              {/* Colored Progress Arc */}
              <path
                d="M 10 50 A 40 40 0 0 1 90 50"
                fill="none"
                stroke={gaugeColor}
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={arcLength}
                strokeDashoffset={arcLength - (Math.min(100, displayInquiriesPct) / 100) * arcLength}
                style={{ transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
              />

              {/* Tick Marks */}
              {[0, 25, 50, 75, 100].map((p) => {
                const angle = -180 + p * 1.8;
                return (
                  <line
                    key={p}
                    x1="50"
                    y1="10"
                    x2="50"
                    y2="14"
                    stroke="#cbd5e1"
                    strokeWidth="1.5"
                    transform={`rotate(${angle}, 50, 50)`}
                  />
                );
              })}

              {/* Needle (Speedometer pointer) */}
              <g 
                transform={`rotate(${-180 + Math.min(100, displayInquiriesPct) * 1.8}, 50, 50)`} 
                style={{ transition: 'transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)' }}
              >
                {/* Sleek tapered needle */}
                <path
                  d="M 48.5 50 L 50 11 L 51.5 50 Z"
                  fill="#f43f5e"
                />
                {/* Needle base circle */}
                <circle cx="50" cy="50" r="4" fill="#f43f5e" />
              </g>

              {/* Center Hub Cap */}
              <circle cx="50" cy="50" r="2.5" fill="#1e293b" />
              <circle cx="50" cy="50" r="1" fill="#94a3b8" />

              {/* Labels */}
              <text x="12" y="58" textAnchor="middle" className="text-[7px] font-bold fill-slate-400">0%</text>
              <text x="50" y="58" textAnchor="middle" className="text-[7px] font-bold fill-slate-400">50%</text>
              <text x="88" y="58" textAnchor="middle" className="text-[7px] font-bold fill-slate-400">100%</text>
            </svg>
          </div>
          <div className="text-center -mt-2">
            <span className="text-sm font-extrabold text-slate-800 block leading-none">
              {inquiriesUsage.used.toLocaleString()}건
            </span>
            <span className="text-[10px] text-slate-400 font-medium mt-1 block">
              {inquiriesUsage.limit !== null ? `한도 ${inquiriesUsage.limit.toLocaleString()}건` : '무제한'}
            </span>
          </div>
        </div>

        {/* Status Panel / Progress Bars */}
        <div className="w-full sm:flex-1 space-y-4 min-w-0">
          {/* Active Users */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-semibold">활성 업무 계정</span>
              <span className="text-slate-800 font-bold tabular-nums">
                {userUsage.used}명 {userUsage.limit != null ? `/ ${userUsage.limit}명` : '(무제한)'}
              </span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isUserOver ? 'bg-rose-500' : userPct != null && userPct >= 80 ? 'bg-amber-500' : 'bg-indigo-600'
                }`}
                style={{ width: `${Math.min(100, userPct ?? 100)}%` }}
              />
            </div>
            {userUsage.limit != null && (
              <p className="text-[10px] text-slate-400">
                {isUserOver ? '정원을 초과했습니다.' : `정원 대비 ${userPct}% 사용 중`}
              </p>
            )}
          </div>

          {/* Operating Brands */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500 font-semibold">활성 브랜드</span>
              <span className="text-slate-800 font-bold tabular-nums">
                {brandsUsage.used}개 {brandsUsage.limit != null ? `/ ${brandsUsage.limit}개` : '(무제한)'}
              </span>
            </div>
            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isBrandsOver ? 'bg-rose-500' : brandsPct >= 80 ? 'bg-amber-500' : 'bg-indigo-600'
                }`}
                style={{ width: `${Math.min(100, brandsPct)}%` }}
              />
            </div>
            {brandsUsage.limit != null && (
              <p className="text-[10px] text-slate-400">
                {isBrandsOver ? '브랜드 한도를 초과했습니다.' : `한도 대비 ${brandsPct}% 사용 중`}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
