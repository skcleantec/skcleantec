import type { NavigateFunction } from 'react-router-dom';
import type { DashboardInquiryBreakdown, DashboardStats } from '../../../api/dashboard';
import { DashboardTelecrmBlock } from '../DashboardTelecrmBlock';
import { DashboardTenantSubscriptionBlock } from '../DashboardTenantSubscriptionBlock';
import { TelemarketingSessionBlock } from '../TelemarketingSessionBlock';
import { DashboardInquiryAnalyticsPanel } from './DashboardInquiryAnalyticsPanel';
import { DashboardSalesBlock } from './DashboardSalesBlock';
import { DashboardStatCard } from './DashboardStatCard';
import type { DashboardDrillKind } from './dashboardDrilldownTypes';
import { kstMonthKeyNow } from './dashboardDrilldownTypes';

export type DashboardAuxBlockVariant = 'card' | 'row';

function kstMonthTitleKo(): string {
  const k = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);
  const [y, m] = k.split('-');
  return `${y}년 ${parseInt(m, 10)}월`;
}

export function DashboardAuxBlocksGrid({ showTelecrmDashboard }: { showTelecrmDashboard: boolean }) {
  return (
    <>
      <div className="lg:hidden overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm divide-y divide-slate-100">
        <DashboardTenantSubscriptionBlock variant="row" />
        <TelemarketingSessionBlock variant="row" />
        {showTelecrmDashboard ? <DashboardTelecrmBlock variant="row" /> : null}
      </div>
      <div className="hidden lg:flex lg:flex-col lg:gap-5">
        <DashboardTenantSubscriptionBlock variant="card" />
        <TelemarketingSessionBlock variant="card" />
        {showTelecrmDashboard ? <DashboardTelecrmBlock variant="card" /> : null}
      </div>
    </>
  );
}

export function DashboardKpiGrid({
  stats,
  loading,
  navigate,
  compact = false,
}: {
  stats: DashboardStats | null;
  loading: boolean;
  navigate: NavigateFunction;
  compact?: boolean;
}) {
  return (
    <div className={`grid grid-cols-2 lg:grid-cols-4 ${compact ? 'gap-2 lg:gap-3' : 'gap-3 lg:gap-5'}`}>
      <DashboardStatCard
        compact={compact}
        label="오늘 접수"
        value={loading ? '-' : stats?.todayCount ?? 0}
        theme="indigo"
        icon={
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        }
        onClick={() => navigate('/admin/inquiries?datePreset=today')}
      />
      <DashboardStatCard
        compact={compact}
        label="이번달 미분배"
        value={loading ? '-' : stats?.unassignedCount ?? 0}
        theme="amber"
        icon={
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
        }
        onClick={() => {
          const mk = kstMonthKeyNow();
          navigate(`/admin/inquiries?datePreset=month&month=${encodeURIComponent(mk)}&status=RECEIVED`);
        }}
      />
      <DashboardStatCard
        compact={compact}
        label="해피콜 미완(마감 초과)"
        value={loading ? '-' : stats?.happyCallOverdueCount ?? 0}
        theme="rose"
        icon={
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        }
        onClick={() => navigate('/admin/inquiries?datePreset=all')}
      />
      <DashboardStatCard
        compact={compact}
        label="해피콜 미완(마감 전)"
        value={loading ? '-' : stats?.happyCallPendingBeforeDeadlineCount ?? 0}
        theme="slate"
        icon={
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
        }
        onClick={() => navigate('/admin/inquiries?datePreset=all')}
      />
    </div>
  );
}

export function DashboardTeamPanelsGrid({
  stats,
  loading,
  compact = false,
}: {
  stats: DashboardStats | null;
  loading: boolean;
  compact?: boolean;
}) {
  const sectionClass = compact
    ? "bg-slate-50/40 rounded-xl border border-slate-100 p-4"
    : "rounded-2xl border border-slate-200/60 bg-white p-4 lg:p-4 shadow-sm shadow-slate-100/50";

  return (
    <div className={`grid grid-cols-1 ${compact ? 'gap-4' : 'gap-5 lg:grid-cols-2 lg:gap-4'}`}>
      <div className={sectionClass}>
        <div className="mb-3 border-b border-slate-100 pb-2.5 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-fluid-sm font-semibold text-slate-900 flex items-center gap-1.5">
              <svg className="w-4 h-4 shrink-0 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
              </svg>
              이번 달 현장 업무
            </h2>
            <p className="text-fluid-2xs text-gray-500 leading-snug mt-0.5 truncate">
              {kstMonthTitleKo()} · 접수 이번 달(KST) · 취소 제외 · 팀장 배정(1차)
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-medium text-indigo-700 ring-1 ring-inset ring-indigo-700/10">
            실시간
          </span>
        </div>
        {loading ? (
          <div className="py-10 flex justify-center items-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-500" />
            <span className="ml-2 text-fluid-2xs text-gray-400">불러오는 중…</span>
          </div>
        ) : (stats?.teamLeaderWorkloadThisMonth?.length ?? 0) === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 py-8 px-4 text-center text-fluid-2xs text-gray-500">
            해당 건이 없습니다.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 sm:divide-x sm:divide-gray-100">
            {(() => {
              const rows = stats!.teamLeaderWorkloadThisMonth!;
              const bySumKm = [...rows]
                .filter((r) => (r.sumKmFromJuan ?? 0) > 0)
                .sort((a, b) => (b.sumKmFromJuan ?? 0) - (a.sumKmFromJuan ?? 0));
              const byJob = [...rows].sort((a, b) => b.jobCount - a.jobCount);
              const fmtKm = (n: number) =>
                Number.isInteger(n) ? n.toLocaleString('ko-KR') : n.toLocaleString('ko-KR', { maximumFractionDigits: 1 });
              return (
                <>
                  <div className="min-w-0 sm:pr-3">
                    <p className="text-fluid-2xs font-semibold text-gray-700 mb-0.5">누적 거리 (주안)</p>
                    <p className="text-[10px] text-gray-400 mb-1.5 leading-tight">배정 건 중 좌표 있는 거리 합(km)</p>
                    {bySumKm.length === 0 ? (
                      <p className="text-[10px] text-amber-800/90 bg-amber-50/80 rounded-lg px-2 py-2 leading-snug">
                        등록된 좌표가 없습니다.
                      </p>
                    ) : (
                      <ul className="space-y-0.5 max-h-40 lg:max-h-52 overflow-y-auto overscroll-y-contain">
                        {bySumKm.map((row, idx) => (
                          <li
                            key={`km-${row.teamLeaderId}`}
                            className="flex items-center gap-2 px-2 py-1 text-fluid-2xs rounded-lg hover:bg-slate-50 transition-colors"
                          >
                            <span className="w-5 h-5 shrink-0 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-semibold text-[10px]">
                              {idx + 1}
                            </span>
                            <span className="flex-1 min-w-0 truncate text-gray-800 font-medium" title={row.name}>
                              {row.name}
                            </span>
                            <span className="shrink-0 tabular-nums font-bold text-slate-800">
                              {fmtKm(row.sumKmFromJuan ?? 0)}
                              <span className="text-slate-400 font-normal ml-0.5 text-[10px]">km</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div className="min-w-0 sm:pl-3">
                    <p className="text-fluid-2xs font-semibold text-gray-700 mb-0.5">배정 건수</p>
                    <p className="text-[10px] text-gray-400 mb-1.5 leading-tight">동일 조건 배정 완료 목록</p>
                    <ul className="space-y-0.5 max-h-40 lg:max-h-52 overflow-y-auto overscroll-y-contain">
                      {byJob.map((row, idx) => (
                        <li
                          key={`job-${row.teamLeaderId}`}
                          className="flex items-center gap-2 px-2 py-1 text-fluid-2xs rounded-lg hover:bg-slate-50 transition-colors"
                        >
                          <span className="w-5 h-5 shrink-0 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-semibold text-[10px]">
                            {idx + 1}
                          </span>
                          <span className="flex-1 min-w-0 truncate text-gray-800 font-medium" title={row.name}>
                            {row.name}
                          </span>
                          <span className="shrink-0 tabular-nums font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full text-[10px]">
                            {row.jobCount}건
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>

      <div className={sectionClass}>
        <div className="mb-3 border-b border-slate-100 pb-2.5 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-fluid-sm font-semibold text-slate-900 flex items-center gap-1.5">
              <svg className="w-4 h-4 shrink-0 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              오늘의 운영 인원 현황
            </h2>
            <p className="text-fluid-2xs text-gray-500 mt-0.5">
              {new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10)} (KST)
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-700/10">
            오늘
          </span>
        </div>
        {loading ? (
          <div className="py-10 flex justify-center items-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-500" />
            <span className="ml-2 text-fluid-2xs text-gray-400">불러오는 중…</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 sm:divide-x sm:divide-gray-100">
            <div className="min-w-0 sm:pr-3">
              <p className="text-fluid-2xs font-semibold text-gray-700 mb-0.5">팀장 휴무</p>
              <p className="text-[10px] text-gray-400 mb-1.5 leading-tight">오늘 휴무 신청 처리된 팀장 목록</p>
              {(stats?.teamLeaderDayOffToday?.length ?? 0) === 0 ? (
                <p className="text-fluid-2xs text-gray-400 bg-gray-50/50 rounded-lg p-2.5 text-center border border-dashed border-gray-100">
                  휴무인 팀장이 없습니다.
                </p>
              ) : (
                <ul className="space-y-0.5 max-h-40 lg:max-h-52 overflow-y-auto overscroll-y-contain">
                  {stats!.teamLeaderDayOffToday!.map((p) => (
                    <li key={p.teamLeaderId} className="px-2 py-1 text-fluid-2xs text-gray-800 bg-slate-50 rounded-lg font-medium flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                      <span className="truncate" title={p.name}>{p.name} (팀장)</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="min-w-0 sm:pl-3">
              <p className="text-fluid-2xs font-semibold text-gray-700 mb-0.5">팀원 · 일일 명단 제외</p>
              <p className="text-[10px] text-gray-400 mb-1.5 leading-tight">조장 일일 명단에 오늘 미포함 (배정 후보 제외)</p>
              {!stats?.dailyRosterModeActive ? (
                <p className="text-fluid-2xs text-gray-400 bg-gray-50/50 rounded-lg p-2.5 text-center border border-dashed border-gray-100 leading-snug">
                  일일 명단 모드가 활성화된 크루 그룹이 없습니다.
                </p>
              ) : (stats?.teamMembersDailyRosterRestToday?.length ?? 0) === 0 ? (
                <p className="text-fluid-2xs text-emerald-600 bg-emerald-50/30 rounded-lg p-2.5 text-center border border-dashed border-emerald-100 leading-snug">
                  모든 팀원이 일일 명단에 포함되어 배정 가능 상태입니다.
                </p>
              ) : (
                <ul className="space-y-0.5 max-h-40 lg:max-h-52 overflow-y-auto overscroll-y-contain">
                  {stats!.teamMembersDailyRosterRestToday!.map((m) => (
                    <li key={m.teamMemberId} className="px-2 py-1 text-fluid-2xs text-gray-800 bg-slate-50 rounded-lg font-medium flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                      <span className="truncate" title={m.name}>{m.name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function DashboardSalesAnalyticsGrid({
  stats,
  loading,
  breakdown,
  breakdownLoading,
  breakdownError,
  onOpenDrill,
}: {
  stats: DashboardStats | null;
  loading: boolean;
  breakdown: DashboardInquiryBreakdown | null;
  breakdownLoading: boolean;
  breakdownError: string | null;
  onOpenDrill: (kind: DashboardDrillKind, initialMonth?: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4 min-w-0 w-full max-w-full [&>section]:min-h-0 lg:[&>section]:min-h-[320px]">
      <DashboardSalesBlock stats={stats} loading={loading} onOpenDrill={() => onOpenDrill('sales', kstMonthKeyNow())} />
      <DashboardInquiryAnalyticsPanel
        breakdown={breakdown}
        loading={breakdownLoading}
        error={breakdownError}
        onOpenDrill={onOpenDrill}
      />
    </div>
  );
}
