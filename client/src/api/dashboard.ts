const API = '/api';

export interface DashboardStats {
  todayCount: number;
  unassignedCount: number;
  inProgressCount: number;
  todaySales: number;
  monthSales: number;
  salesByTeamLeader: Array<{ teamLeaderId: string; name: string; amount: number }>;
  dailySales: Array<{ date: string; amount: number }>;
}

export async function getDashboardStats(token: string): Promise<DashboardStats> {
  const res = await fetch(`${API}/dashboard/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('통계를 불러올 수 없습니다.');
  return res.json();
}
