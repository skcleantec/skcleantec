import { API, apiErrorMessage } from './apiPrefix';
import { isLikelyNetworkFailure } from './fetchNetwork';

function apiUnreachableMessage(): Error {
  return new Error(
    'API 서버에 연결할 수 없습니다. npm run dev 로 API와 Vite를 함께 켜 주세요. Cursor 내장 브라우저는 루프백에서 자동으로 API에 직접 붙습니다.'
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
  } catch (e) {
    if (isLikelyNetworkFailure(e)) {
      throw apiUnreachableMessage();
    }
    throw e instanceof Error ? e : new Error(String(e));
  }
  if (!res.ok) {
    if (res.status === 502 || res.status === 503) {
      throw apiUnreachableMessage();
    }
    throw new Error(await apiErrorMessage(res, '통계를 불러올 수 없습니다.'));
  }
  return res.json();
}
