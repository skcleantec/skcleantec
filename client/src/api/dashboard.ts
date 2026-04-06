const API = '/api';

export interface DashboardStats {
  todayCount: number;
  unassignedCount: number;
  todaySales: number;
  monthSales: number;
  salesByTeamLeader: Array<{ teamLeaderId: string; name: string; amount: number }>;
  dailySales: Array<{ date: string; amount: number }>;
  /** 배정·예약일 있는 해피콜 미완 중 마감(작업일 전날 KST 말일) 지남 */
  happyCallOverdueCount: number;
  /** 마감 전 미완 */
  happyCallPendingBeforeDeadlineCount: number;
}

export async function getDashboardStats(token: string): Promise<DashboardStats> {
  const res = await fetch(`${API}/dashboard/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('통계를 불러올 수 없습니다.');
  return res.json();
}
