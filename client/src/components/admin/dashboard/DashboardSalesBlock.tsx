import { useState } from 'react';
import type { DashboardStats } from '../../../api/dashboard';
import { DashboardStatCard } from './DashboardStatCard';
import { DashboardVerticalBarChart } from './DashboardMiniBarChart';
import { DashboardTeamPanelsGrid } from './DashboardPageSections';
import {
  dashboardSectionHeader,
  dashboardSectionShell,
  dashboardSectionSubtitle,
  dashboardSectionTitle,
} from './dashboardMobileLayout';

function formatCurrency(n: number): string {
  return n.toLocaleString('ko-KR') + '원';
}

export function DashboardSalesBlock({
  stats,
  loading,
  onOpenDrill,
}: {
  stats: DashboardStats | null;
  loading: boolean;
  onOpenDrill?: () => void;
}) {
  const [teamPanelsOpen, setTeamPanelsOpen] = useState(false);
  const dailyChartItems =
    stats?.dailySales?.map((d) => ({
      key: d.date,
      label: d.date.slice(8),
      value: d.amount,
      subLabel: `${d.date.slice(5).replace('-', '/')} · ${formatCurrency(d.amount)}`,
    })) ?? [];

  return (
    <section
      className={`${dashboardSectionShell} ${
        onOpenDrill ? 'cursor-pointer hover:border-slate-300/80 transition-colors' : ''
      }`}
      role={onOpenDrill ? 'button' : undefined}
      tabIndex={onOpenDrill ? 0 : undefined}
      onClick={onOpenDrill}
      onKeyDown={
        onOpenDrill
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onOpenDrill();
              }
            }
          : undefined
      }
    >
      <div className={dashboardSectionHeader}>
        <h2 className={`${dashboardSectionTitle} flex items-center gap-1.5`}>
          <svg className="w-4 h-4 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          매출 및 정산 현황
        </h2>
        <p className={`${dashboardSectionSubtitle} hidden sm:block`}>접수일(KST) 기준 · 확정 접수만 · 클릭하면 기간별 상세</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-[minmax(10.5rem,2fr)_minmax(0,3fr)] gap-2 lg:gap-3 mb-3 lg:mb-5">
        <div className="flex min-w-0 flex-col gap-2 lg:gap-3 col-span-2 sm:col-span-1">
          <DashboardStatCard
            compact
            label="오늘 매출"
            value={loading ? '-' : formatCurrency(stats?.todaySales ?? 0)}
            theme="emerald"
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
          />
          <DashboardStatCard
            compact
            label="이번 달 매출"
            value={loading ? '-' : formatCurrency(stats?.monthSales ?? 0)}
            theme="indigo"
            icon={
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            }
          />
        </div>

        {!loading && dailyChartItems.length > 0 ? (
          <div className="min-w-0 rounded-lg lg:rounded-xl border border-slate-100 bg-slate-50/40 p-2 lg:p-3 col-span-2 sm:col-span-1">
            <h3 className="text-[11px] lg:text-fluid-2xs font-semibold text-gray-700 mb-1.5 lg:mb-2 flex items-center gap-1.5">
              <span className="w-1.5 h-3 rounded-full bg-blue-500" />
              최근 7일 매출
            </h3>
            <DashboardVerticalBarChart
              items={dailyChartItems}
              accentClass="bg-blue-500"
              peakAccentClass="bg-indigo-600"
              formatValue={(n) => formatCurrency(n)}
              barAreaClass="h-[3rem] lg:h-[4.5rem]"
              dense
              ariaLabel="최근 7일 일별 매출"
            />
          </div>
        ) : (
          <div className="hidden sm:block" />
        )}
      </div>

      {!loading && stats?.salesByTeamLeader && stats.salesByTeamLeader.some((s) => s.amount > 0) ? (
        <div>
          <h3 className="text-fluid-2xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
            <span className="w-1.5 h-3 rounded-full bg-indigo-500" />
            팀장별 매출
          </h3>
          <div className="max-h-28 lg:max-h-44 overflow-y-auto overscroll-y-contain rounded-lg lg:rounded-xl border border-slate-100 shadow-sm shadow-slate-100/30">
            <table className="w-full text-fluid-2xs whitespace-nowrap">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50/95 border-b border-slate-100 text-gray-500 font-medium">
                  <th className="text-center py-2 px-3 font-semibold">팀장</th>
                  <th className="text-right py-2 px-3 font-semibold">매출</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {stats.salesByTeamLeader
                  .filter((s) => s.amount > 0)
                  .map((s) => (
                    <tr key={s.teamLeaderId} className="hover:bg-slate-50/50">
                      <td className="py-2 px-3 text-gray-800 font-medium text-center truncate max-w-[8rem]" title={s.name}>
                        {s.name}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-gray-900 tabular-nums">
                        {formatCurrency(s.amount)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : loading ? (
        <div className="py-8 flex justify-center items-center">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-500" />
          <span className="ml-2 text-fluid-2xs text-gray-400">불러오는 중…</span>
        </div>
      ) : null}

      <div
        className="mt-3 lg:mt-6 pt-3 lg:pt-5 border-t border-slate-100"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="presentation"
      >
        <div className="lg:hidden">
          <button
            type="button"
            onClick={() => setTeamPanelsOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-2 text-left text-[11px] font-medium text-slate-700 touch-manipulation"
          >
            <span>현장·운영 인원 현황</span>
            <span className="shrink-0 text-slate-400">{teamPanelsOpen ? '접기' : '펼치기'}</span>
          </button>
          {teamPanelsOpen ? (
            <div className="mt-2">
              <DashboardTeamPanelsGrid stats={stats} loading={loading} compact />
            </div>
          ) : null}
        </div>
        <div className="hidden lg:block">
          <DashboardTeamPanelsGrid stats={stats} loading={loading} compact />
        </div>
      </div>
    </section>
  );
}
