import { useState, useEffect } from 'react';
import { getDashboardStats, type DashboardStats } from '../../api/dashboard';
import { getToken } from '../../stores/auth';
import { DashboardChangeHistory } from '../../components/admin/DashboardChangeHistory';

function formatCurrency(n: number): string {
  return n.toLocaleString() + '원';
}

export function AdminDashboardPage() {
  const token = getToken();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setApiError(null);
    getDashboardStats(token)
      .then((data) => {
        setStats(data);
        setApiError(null);
      })
      .catch((err) => {
        setStats({
          todayCount: 0,
          unassignedCount: 0,
          inProgressCount: 0,
          todaySales: 0,
          monthSales: 0,
          salesByTeamLeader: [],
          dailySales: [],
        });
        setApiError(err instanceof Error ? err.message : '서버에 연결할 수 없습니다.');
      })
      .finally(() => setLoading(false));
  }, [token]);

  const maxDaily = stats?.dailySales?.length ? Math.max(...stats.dailySales.map((d) => d.amount), 1) : 1;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-gray-800">메인 대시보드</h1>

      {apiError && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {apiError} (서버가 실행 중인지 확인하세요.)
        </div>
      )}

      {/* 접수 통계 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="오늘 접수" value={loading ? '-' : stats?.todayCount ?? 0} />
        <StatCard label="미분배" value={loading ? '-' : stats?.unassignedCount ?? 0} />
        <StatCard label="진행중" value={loading ? '-' : stats?.inProgressCount ?? 0} />
      </div>

      {/* 매출 통계 */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-base font-medium text-gray-800 mb-4">매출 현황</h2>
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
            <h3 className="text-sm font-medium text-gray-700 mb-3">최근 7일 매출</h3>
            <div className="flex gap-2 items-end h-24">
              {stats.dailySales.map((d) => (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full bg-blue-500 rounded-t min-h-[4px]"
                    style={{ height: `${Math.max(4, (d.amount / maxDaily) * 80)}px` }}
                    title={formatCurrency(d.amount)}
                  />
                  <span className="text-[10px] text-gray-500">
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
            <h3 className="text-sm font-medium text-gray-700 mb-3">팀장별 매출</h3>
            <div className="border border-gray-200 rounded overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left py-2 px-3 font-medium text-gray-700">팀장</th>
                    <th className="text-right py-2 px-3 font-medium text-gray-700">매출</th>
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
}: {
  label: string;
  value: number | string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg p-4 ${
        highlight ? 'bg-blue-50 border border-blue-200' : 'bg-white border border-gray-200'
      }`}
    >
      <p className="text-sm text-gray-600">{label}</p>
      <p className="text-2xl font-semibold text-gray-800 mt-1">{value}</p>
    </div>
  );
}
