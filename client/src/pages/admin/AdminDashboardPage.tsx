import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDashboardStats, type DashboardStats } from '../../api/dashboard';
import { getToken } from '../../stores/auth';
import { DashboardChangeHistory } from '../../components/admin/DashboardChangeHistory';
import { TelemarketingSessionBlock } from '../../components/admin/TelemarketingSessionBlock';

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
      <h1 className="text-fluid-xl font-semibold text-gray-800">메인 대시보드</h1>

      {apiError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-fluid-sm">
          {apiError}
        </div>
      )}

      <TelemarketingSessionBlock />

      {/* 팀 현황: 이번 달 업무량 · 오늘 휴무 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
          <div className="mb-2 border-b border-gray-100 pb-2">
            <h2 className="text-fluid-sm font-semibold text-gray-900">이번 달 현장 업무</h2>
            <p className="text-fluid-2xs text-gray-500 leading-snug mt-0.5">
              {kstMonthTitleKo()} · 접수 이번 달(KST) · 취소 제외 · 팀장 배정(1차)
            </p>
          </div>
          {loading ? (
            <p className="py-6 text-center text-fluid-2xs text-gray-400">불러오는 중…</p>
          ) : (stats?.teamLeaderWorkloadThisMonth?.length ?? 0) === 0 ? (
            <p className="rounded border border-dashed border-gray-200 bg-gray-50/80 py-6 px-2 text-center text-fluid-2xs text-gray-500">
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
                      <p className="text-fluid-2xs font-medium text-gray-700 mb-1">누적 거리 (주안)</p>
                      <p className="text-[10px] text-gray-400 mb-1.5 leading-tight">
                        배정 건 중 좌표 있는 거리 합(km)
                      </p>
                      {bySumKm.length === 0 ? (
                        <p className="text-[10px] text-amber-800/90 bg-amber-50/80 rounded px-1.5 py-1.5 leading-snug">
                          좌표 없음
                        </p>
                      ) : (
                        <ul className="space-y-0 border border-gray-100 rounded overflow-hidden">
                          {bySumKm.map((row, idx) => (
                            <li
                              key={`km-${row.teamLeaderId}`}
                              className="flex items-center gap-1.5 px-1.5 py-1 text-fluid-2xs border-b border-gray-50 last:border-0 bg-white"
                            >
                              <span className="w-4 shrink-0 tabular-nums text-gray-400 text-center">{idx + 1}</span>
                              <span className="flex-1 min-w-0 truncate text-gray-900" title={row.name}>
                                {row.name}
                              </span>
                              <span className="shrink-0 tabular-nums font-medium text-gray-800">
                                {fmtKm(row.sumKmFromJuan ?? 0)}
                                <span className="text-gray-400 font-normal ml-0.5">km</span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="min-w-0 sm:pl-1">
                      <p className="text-fluid-2xs font-medium text-gray-700 mb-1">건수</p>
                      <p className="text-[10px] text-gray-400 mb-1.5 leading-tight">동일 조건</p>
                      <ul className="space-y-0 border border-gray-100 rounded overflow-hidden">
                        {byJob.map((row, idx) => (
                          <li
                            key={`job-${row.teamLeaderId}`}
                            className="flex items-center gap-1.5 px-1.5 py-1 text-fluid-2xs border-b border-gray-50 last:border-0"
                          >
                            <span className="w-4 shrink-0 tabular-nums text-gray-400 text-center">{idx + 1}</span>
                            <span className="flex-1 min-w-0 truncate text-gray-900" title={row.name}>
                              {row.name}
                            </span>
                            <span className="shrink-0 tabular-nums font-medium text-indigo-950">{row.jobCount}</span>
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

        <section className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
          <div className="mb-2 border-b border-gray-100 pb-2">
            <h2 className="text-fluid-sm font-semibold text-gray-900">오늘 인원</h2>
            <p className="text-fluid-2xs text-gray-500 mt-0.5">
              {new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10)} (KST)
            </p>
          </div>
          {loading ? (
            <p className="py-4 text-center text-fluid-2xs text-gray-400">불러오는 중…</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 sm:divide-x sm:divide-gray-100">
              <div className="min-w-0 sm:pr-3">
                <p className="text-fluid-2xs font-medium text-gray-700 mb-1">팀장 휴무</p>
                <p className="text-[10px] text-gray-400 mb-1.5 leading-tight">스케줄 휴무 등록</p>
                {(stats?.teamLeaderDayOffToday?.length ?? 0) === 0 ? (
                  <p className="text-fluid-2xs text-gray-400 py-1">없음</p>
                ) : (
                  <ul className="border border-gray-100 rounded overflow-hidden divide-y divide-gray-50">
                    {stats!.teamLeaderDayOffToday!.map((p) => (
                      <li key={p.teamLeaderId} className="px-1.5 py-1 text-fluid-2xs text-gray-900 truncate" title={p.name}>
                        {p.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="min-w-0 sm:pl-1">
                <p className="text-fluid-2xs font-medium text-gray-700 mb-1">팀원 · 명단 제외</p>
                <p className="text-[10px] text-gray-400 mb-1.5 leading-tight">
                  조장 일일 명단에 오늘 미포함 (배정 후보 제외)
                </p>
                {!stats?.dailyRosterModeActive ? (
                  <p className="text-fluid-2xs text-gray-400 py-1 leading-snug">
                    일일 명단 모드 크루 없음
                  </p>
                ) : (stats?.teamMembersDailyRosterRestToday?.length ?? 0) === 0 ? (
                  <p className="text-fluid-2xs text-gray-400 py-1">없음 · 명단에 포함된 상태</p>
                ) : (
                  <ul className="border border-gray-100 rounded overflow-hidden divide-y divide-gray-50 max-h-40 overflow-y-auto overscroll-y-contain">
                    {stats!.teamMembersDailyRosterRestToday!.map((m) => (
                      <li key={m.teamMemberId} className="px-1.5 py-1 text-fluid-2xs text-gray-900 truncate" title={m.name}>
                        {m.name}
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="오늘 접수"
          value={loading ? '-' : stats?.todayCount ?? 0}
          onClick={() => navigate('/admin/inquiries?datePreset=today')}
        />
        <StatCard
          label="이번달 미분배"
          value={loading ? '-' : stats?.unassignedCount ?? 0}
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
          onClick={() => navigate('/admin/inquiries?datePreset=all')}
          highlight
        />
        <StatCard
          label="해피콜 미완(마감 전)"
          value={loading ? '-' : stats?.happyCallPendingBeforeDeadlineCount ?? 0}
          onClick={() => navigate('/admin/inquiries?datePreset=all')}
        />
      </div>

      {/* 매출 통계 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-fluid-base font-medium text-gray-800 mb-4">매출 현황</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <StatCard
            label="오늘 매출"
            value={loading ? '-' : formatCurrency(stats?.todaySales ?? 0)}
            highlight
          />
          <StatCard
            label="이번 달 매출"
            value={loading ? '-' : formatCurrency(stats?.monthSales ?? 0)}
            highlight
          />
        </div>

        {/* 최근 7일 매출 그래프 */}
        {stats?.dailySales && stats.dailySales.length > 0 && (
          <div className="mb-6">
            <h3 className="text-fluid-sm font-medium text-gray-700 mb-3">최근 7일 매출</h3>
            <div className="flex gap-2 items-end h-24">
              {stats.dailySales.map((d) => (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-blue-500 rounded-t min-h-[4px]"
                    style={{ height: `${Math.max(4, (d.amount / maxDaily) * 80)}px` }}
                    title={formatCurrency(d.amount)}
                  />
                  <span className="text-fluid-2xs text-gray-500">
                    {d.date.slice(5).replace('-', '/')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 팀장별 매출 */}
        {stats?.salesByTeamLeader && stats.salesByTeamLeader.length > 0 && (
          <div>
            <h3 className="text-fluid-sm font-medium text-gray-700 mb-3">팀장별 매출</h3>
            <div className="border border-gray-200 rounded overflow-hidden">
              <table className="w-full text-fluid-sm whitespace-nowrap">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-center py-2 px-3 font-medium text-gray-700">팀장</th>
                    <th className="text-center py-2 px-3 font-medium text-gray-700">매출</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.salesByTeamLeader.map((s) => (
                    <tr key={s.teamLeaderId} className="border-t border-gray-100">
                      <td className="py-2 px-3 text-gray-800">{s.name}</td>
                      <td className="py-2 px-3 text-right font-medium text-gray-900">
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
  highlight,
  onClick,
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
  onClick?: () => void;
}) {
  const inner = (
    <>
      <p className="text-fluid-sm text-gray-600">{label}</p>
      <p className="text-fluid-2xl font-semibold text-gray-800 mt-1 tabular-nums">{value}</p>
    </>
  );
  const base = `rounded-lg p-4 text-left w-full ${
    highlight ? 'bg-blue-50 border border-blue-200' : 'bg-white border border-gray-200'
  }`;
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={`${label} — 서비스접수로 이동`}
        className={`${base} cursor-pointer transition-colors hover:bg-gray-50 hover:border-gray-300 active:bg-gray-100`}
      >
        {inner}
      </button>
    );
  }
  return <div className={base}>{inner}</div>;
}
