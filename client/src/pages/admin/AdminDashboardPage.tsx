import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDashboardStats, type DashboardStats } from '../../api/dashboard';
import { getToken } from '../../stores/auth';
import { DashboardChangeHistory } from '../../components/admin/DashboardChangeHistory';
import { TelemarketingSessionBlock } from '../../components/admin/TelemarketingSessionBlock';

function formatCurrency(n: number): string {
  return n.toLocaleString('ko-KR') + '원';
}

/** 접수 목록 필터와 동일한 KST 연월 YYYY-MM */
function kstMonthKeyNow(): string {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);
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
          {apiError} (서버가 실행 중인지 확인하세요.)
        </div>
      )}

      <TelemarketingSessionBlock />

      {/* 접수 통계 — 접수 목록으로 이동 시 `datePreset`/`month`/`status` 전달. 검색어 입력 시 목록은 자동으로 접수일「전체」로 넓혀짐(AdminInquiriesPage). */}
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
        title={`${label} — 접수 목록으로 이동`}
        className={`${base} cursor-pointer transition-colors hover:bg-gray-50 hover:border-gray-300 active:bg-gray-100`}
      >
        {inner}
      </button>
    );
  }
  return <div className={base}>{inner}</div>;
}
