import { apiErrorMessage } from './apiPrefix';

const API = '/api';

function apiUnreachableMessage(): Error {
  return new Error(
    'API 서버에 연결할 수 없습니다. 프로젝트 루트에서 npm run dev 로 서버(3000)와 클라이언트(5173)를 함께 켜 주세요.'
  );
}

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
  let res: Response;
  try {
    res = await fetch(`${API}/dashboard/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw apiUnreachableMessage();
  }
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, '통계를 불러올 수 없습니다.'));
  }
  return res.json();
}
