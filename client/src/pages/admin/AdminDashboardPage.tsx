import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDashboardStats, type DashboardStats } from '../../api/dashboard';
import { getMe } from '../../api/auth';
import { getToken } from '../../stores/auth';
import { DashboardChangeHistory } from '../../components/admin/DashboardChangeHistory';
import { DashboardOpsHourlyStrip } from '../../components/admin/DashboardOpsHourlyStrip';
import { TelemarketingSessionBlock } from '../../components/admin/TelemarketingSessionBlock';
import { DashboardTenantSubscriptionBlock } from '../../components/admin/DashboardTenantSubscriptionBlock';

function formatCurrency(n: number): string {
  return n.toLocaleString('ko-KR') + '원';
}

/** 서비스접수 필터와 동일한 KST 연월 YYYY-MM */
function kstMonthKeyNow(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);
}

function kstMonthTitleKo(): string {
  const k = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);
  const [y, m] = k.split('-');
  return `${y}년 ${parseInt(m, 10)}월`;
}

export function AdminDashboardPage() {
  const navigate = useNavigate();
  const token = getToken();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [tenantDisplayName, setTenantDisplayName] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    getMe(token)
      .then((u) => {
        const name =
          (typeof u.tenant?.displayName === 'string' && u.tenant.displayName.trim()) ||
          (typeof u.tenant?.name === 'string' && u.tenant.name.trim()) ||
          null;
        setTenantDisplayName(name);
      })
      .catch(() => setTenantDisplayName(null));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    getDashboardStats(token)
      .then((data) => {
        setStats(data);
        setApiError(null);
      })
      .catch((err) => {
        setStats({
          todayCount: 0,
          unassignedCount: 0,
          todaySales: 0,
          monthSales: 0,
          salesByTeamLeader: [],
          dailySales: [],
          happyCallOverdueCount: 0,
          happyCallPendingBeforeDeadlineCount: 0,
          teamLeaderWorkloadThisMonth: [],
          teamLeaderDayOffToday: [],
          teamMembersDailyRosterRestToday: [],
          dailyRosterModeActive: false,
        });
        setApiError(err instanceof Error ? err.message : '서버에 연결할 수 없습니다.');
      })
      .finally(() => setLoading(false));
  }, [token]);

  const maxDaily = stats?.dailySales?.length ? Math.max(...stats.dailySales.map((d) => d.amount), 1) : 1;

  return (
    <div className="space-y-6">
      <h1 className="text-fluid-xl font-semibold tracking-tight text-slate-900">
        {tenantDisplayName ? `${tenantDisplayName} Dashboard` : 'Dashboard'}
      </h1>

      {apiError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-fluid-sm">
          {apiError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DashboardTenantSubscriptionBlock />
        <TelemarketingSessionBlock />
      </div>

      <DashboardOpsHourlyStrip />

      {/* 팀 현황: 이번 달 업무량 · 오늘 휴무 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm shadow-slate-100/50">
          <div className="mb-4 border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-fluid-sm font-semibold text-slate-900 flex items-center gap-1.5">
                <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" />
                </svg>
                이번 달 현장 업무
              </h2>
              <p className="text-fluid-2xs text-gray-500 leading-snug mt-1">
                {kstMonthTitleKo()} · 접수 이번 달(KST) · 취소 제외 · 팀장 배정(1차)
              </p>
            </div>
            <span className="inline-flex items-center rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-medium text-indigo-700 ring-1 ring-inset ring-indigo-700/10">
              실시간 집계
            </span>
          </div>
          {loading ? (
            <div className="py-12 flex justify-center items-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-500"></div>
              <span className="ml-2 text-fluid-2xs text-gray-400">불러오는 중…</span>
            </div>
          ) : (stats?.teamLeaderWorkloadThisMonth?.length ?? 0) === 0 ? (
            <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 py-10 px-4 text-center text-fluid-2xs text-gray-500">
              해당 건이 없습니다.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 sm:divide-x sm:divide-gray-100">
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
                    <div className="min-w-0 sm:pr-4">
                      <p className="text-fluid-2xs font-semibold text-gray-700 mb-1">누적 거리 (주안)</p>
                      <p className="text-[10px] text-gray-400 mb-2 leading-tight">
                        배정 건 중 좌표 있는 거리 합(km)
                      </p>
                      {bySumKm.length === 0 ? (
                        <p className="text-[10px] text-amber-800/90 bg-amber-50/80 rounded-lg px-2 py-2 leading-snug">
                          등록된 좌표가 없습니다.
                        </p>
                      ) : (
                        <ul className="space-y-1">
                          {bySumKm.map((row, idx) => (
                            <li
                              key={`km-${row.teamLeaderId}`}
                              className="flex items-center gap-2 px-2.5 py-1.5 text-fluid-2xs rounded-lg hover:bg-slate-50 transition-colors"
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
                    <div className="min-w-0 sm:pl-4">
                      <p className="text-fluid-2xs font-semibold text-gray-700 mb-1">배정 건수</p>
                      <p className="text-[10px] text-gray-400 mb-2 leading-tight">동일 조건 배정 완료 목록</p>
                      <ul className="space-y-1">
                        {byJob.map((row, idx) => (
                          <li
                            key={`job-${row.teamLeaderId}`}
                            className="flex items-center gap-2 px-2.5 py-1.5 text-fluid-2xs rounded-lg hover:bg-slate-50 transition-colors"
                          >
                            <span className="w-5 h-5 shrink-0 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center font-semibold text-[10px]">
                              {idx + 1}
                            </span>
                            <span className="flex-1 min-w-0 truncate text-gray-800 font-medium" title={row.name}>
                              {row.name}
                            </span>
                            <span className="shrink-0 tabular-nums font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full text-[10px]">
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
        </section>

        <section className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm shadow-slate-100/50">
          <div className="mb-4 border-b border-slate-100 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-fluid-sm font-semibold text-slate-900 flex items-center gap-1.5">
                <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                오늘의 운영 인원 현황
              </h2>
              <p className="text-fluid-2xs text-gray-500 mt-1">
                {new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10)} (KST)
              </p>
            </div>
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-700/10">
              오늘 기준
            </span>
          </div>
          {loading ? (
            <div className="py-12 flex justify-center items-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-500"></div>
              <span className="ml-2 text-fluid-2xs text-gray-400">불러오는 중…</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 sm:divide-x sm:divide-gray-100">
              <div className="min-w-0 sm:pr-4">
                <p className="text-fluid-2xs font-semibold text-gray-700 mb-1">팀장 휴무</p>
                <p className="text-[10px] text-gray-400 mb-2 leading-tight">오늘 휴무 신청 처리된 팀장 목록</p>
                {(stats?.teamLeaderDayOffToday?.length ?? 0) === 0 ? (
                  <p className="text-fluid-2xs text-gray-400 bg-gray-50/50 rounded-lg p-3 text-center border border-dashed border-gray-100">
                    휴무인 팀장이 없습니다.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {stats!.teamLeaderDayOffToday!.map((p) => (
                      <li key={p.teamLeaderId} className="px-2.5 py-1.5 text-fluid-2xs text-gray-800 bg-slate-50 rounded-lg font-medium flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                        <span className="truncate" title={p.name}>{p.name} (팀장)</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="min-w-0 sm:pl-4">
                <p className="text-fluid-2xs font-semibold text-gray-700 mb-1">팀원 · 일일 명단 제외</p>
                <p className="text-[10px] text-gray-400 mb-2 leading-tight">
                  조장 일일 명단에 오늘 미포함 (배정 후보 제외)
                </p>
                {!stats?.dailyRosterModeActive ? (
                  <p className="text-fluid-2xs text-gray-400 bg-gray-50/50 rounded-lg p-3 text-center border border-dashed border-gray-100 leading-snug">
                    일일 명단 모드가 활성화된 크루 그룹이 없습니다.
                  </p>
                ) : (stats?.teamMembersDailyRosterRestToday?.length ?? 0) === 0 ? (
                  <p className="text-fluid-2xs text-emerald-600 bg-emerald-50/30 rounded-lg p-3 text-center border border-dashed border-emerald-100 leading-snug">
                    모든 팀원이 일일 명단에 포함되어 배정 가능 상태입니다.
                  </p>
                ) : (
                  <ul className="space-y-1 max-h-40 overflow-y-auto overscroll-y-contain">
                    {stats!.teamMembersDailyRosterRestToday!.map((m) => (
                      <li key={m.teamMemberId} className="px-2.5 py-1.5 text-fluid-2xs text-gray-800 bg-slate-50 rounded-lg font-medium flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                        <span className="truncate" title={m.name}>{m.name}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* 접수 통계 — 서비스접수로 이동 시 `datePreset`/`month`/`status` 전달. 검색어 입력 시 목록은 자동으로 접수일「전체」로 넓혀짐(AdminInquiriesPage). */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          label="오늘 접수"
          value={loading ? '-' : stats?.todayCount ?? 0}
          theme="indigo"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          }
          onClick={() => navigate('/admin/inquiries?datePreset=today')}
        />
        <StatCard
          label="이번달 미분배"
          value={loading ? '-' : stats?.unassignedCount ?? 0}
          theme="amber"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          }
          onClick={() => {
            const mk = kstMonthKeyNow();
            navigate(
              `/admin/inquiries?datePreset=month&month=${encodeURIComponent(mk)}&status=RECEIVED`
            );
          }}
        />
        <StatCard
          label="해피콜 미완(마감 초과)"
          value={loading ? '-' : stats?.happyCallOverdueCount ?? 0}
          theme="rose"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          }
          onClick={() => navigate('/admin/inquiries?datePreset=all')}
        />
        <StatCard
          label="해피콜 미완(마감 전)"
          value={loading ? '-' : stats?.happyCallPendingBeforeDeadlineCount ?? 0}
          theme="slate"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.94.725l.548 2.2a1 1 0 01-.321.988l-1.305.98a10.582 10.582 0 004.872 4.872l.98-1.305a1 1 0 01.988-.321l2.2.548a1 1 0 01.725.94V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          }
          onClick={() => navigate('/admin/inquiries?datePreset=all')}
        />
      </div>

      {/* 매출 통계 */}
      <div className="bg-white border border-slate-200/60 rounded-2xl p-6 shadow-sm shadow-slate-100/50">
        <h2 className="text-fluid-base font-semibold text-slate-900 mb-4 flex items-center gap-1.5">
          <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          매출 및 정산 현황
        </h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8">
          <StatCard
            label="오늘 매출"
            value={loading ? '-' : formatCurrency(stats?.todaySales ?? 0)}
            theme="emerald"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <StatCard
            label="이번 달 매출"
            value={loading ? '-' : formatCurrency(stats?.monthSales ?? 0)}
            theme="indigo"
            icon={
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
        </div>

        {/* 최근 7일 매출 그래프 */}
        {stats?.dailySales && stats.dailySales.length > 0 && (
          <div className="mb-8 border border-slate-100 bg-slate-50/40 rounded-xl p-5">
            <h3 className="text-fluid-xs font-semibold text-gray-700 mb-4 flex items-center gap-1.5">
              <span className="w-1.5 h-3 rounded-full bg-blue-500"></span>
              최근 7일 일별 매출 추이
            </h3>
            
            <div className="relative h-36 w-full flex items-end">
              {/* Grid Lines */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-5" aria-hidden="true">
                <div className="w-full border-t border-gray-200/50"></div>
                <div className="w-full border-t border-gray-200/50"></div>
                <div className="w-full border-t border-gray-200/50"></div>
                <div className="w-full border-t border-gray-200/50"></div>
              </div>
              
              {/* Bars */}
              <div className="relative z-10 flex w-full gap-3 sm:gap-6 items-end h-full pb-5">
                {stats.dailySales.map((d) => (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-2 group relative">
                    {/* Tooltip */}
                    <div className="absolute opacity-0 group-hover:opacity-100 bottom-full mb-2 bg-gray-900 text-white text-[10px] py-1 px-2 rounded shadow-lg pointer-events-none transition-all duration-200 scale-95 group-hover:scale-100 whitespace-nowrap z-20">
                      {formatCurrency(d.amount)}
                    </div>
                    
                    {/* Bar */}
                    <div
                      className="w-full bg-blue-500 group-hover:bg-indigo-600 rounded-t-md min-h-[4px] transition-all duration-300 shadow-sm shadow-blue-500/20"
                      style={{ height: `${Math.max(4, (d.amount / maxDaily) * 100)}px` }}
                    />
                    
                    {/* Date label */}
                    <span className="text-[10px] text-gray-500 font-medium whitespace-nowrap">
                      {d.date.slice(5).replace('-', '/')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 팀장별 매출 */}
        {stats?.salesByTeamLeader && stats.salesByTeamLeader.length > 0 && (
          <div>
            <h3 className="text-fluid-xs font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
              <span className="w-1.5 h-3 rounded-full bg-indigo-500"></span>
              팀장별 매출 기여도
            </h3>
            <div className="border border-slate-100 rounded-xl overflow-hidden shadow-sm shadow-slate-100/30">
              <table className="w-full text-fluid-sm whitespace-nowrap">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100 text-gray-500 text-fluid-2xs font-medium">
                    <th className="text-center py-2.5 px-4 font-semibold">팀장명</th>
                    <th className="text-right py-2.5 px-4 font-semibold">누적 매출액</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {stats.salesByTeamLeader.map((s) => (
                    <tr key={s.teamLeaderId} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-3 px-4 text-gray-800 font-medium text-center">{s.name}</td>
                      <td className="py-3 px-4 text-right font-bold text-gray-900 tabular-nums">
                        {formatCurrency(s.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {token && <DashboardChangeHistory token={token} />}
    </div>
  );
}

function StatCard({
  label,
  value,
  theme = 'slate',
  icon,
  onClick,
}: {
  label: string;
  value: number | string;
  theme?: 'indigo' | 'amber' | 'rose' | 'emerald' | 'slate';
  icon?: React.ReactNode;
  onClick?: () => void;
}) {
  const themeClasses = {
    indigo: 'bg-indigo-50/30 border-indigo-100 hover:border-indigo-200 text-indigo-600 ring-indigo-500/5',
    amber: 'bg-amber-50/30 border-amber-100 hover:border-amber-200 text-amber-600 ring-amber-500/5',
    rose: 'bg-rose-50/30 border-rose-100 hover:border-rose-200 text-rose-600 ring-rose-500/5',
    emerald: 'bg-emerald-50/30 border-emerald-100 hover:border-emerald-200 text-emerald-600 ring-emerald-500/5',
    slate: 'bg-white border-slate-200 hover:border-slate-300 text-slate-600 ring-slate-900/5',
  };

  const iconClasses = {
    indigo: 'text-indigo-600 bg-indigo-100/60',
    amber: 'text-amber-600 bg-amber-100/60',
    rose: 'text-rose-600 bg-rose-100/60',
    emerald: 'text-emerald-600 bg-emerald-100/60',
    slate: 'text-gray-500 bg-gray-100/80',
  };

  const inner = (
    <div className="flex items-center justify-between w-full">
      <div className="min-w-0">
        <p className="text-fluid-xs font-semibold text-slate-500 truncate">{label}</p>
        <p className="text-fluid-2xl font-bold text-slate-950 mt-1.5 tabular-nums tracking-tight">{value}</p>
      </div>
      {icon && (
        <div className={`p-2.5 rounded-xl shrink-0 ${iconClasses[theme]}`}>
          {icon}
        </div>
      )}
    </div>
  );

  const base = `rounded-2xl p-5 text-left w-full border shadow-sm transition-all duration-200 ${themeClasses[theme]}`;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={`${label} — 서비스접수로 이동`}
        className={`${base} cursor-pointer hover:shadow-md hover:-translate-y-0.5 active:translate-y-0`}
      >
        {inner}
      </button>
    );
  }
  return <div className={base}>{inner}</div>;
}
