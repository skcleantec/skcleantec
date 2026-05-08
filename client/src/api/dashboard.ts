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
  /** 이번 달 접수일(KST)·취소 제외·팀장 배정 건수·주안 km 누적합·최대 km — 1차 배정 팀장 */
  teamLeaderWorkloadThisMonth: Array<{
    teamLeaderId: string;
    name: string;
    jobCount: number;
    /** 인천 주안 기준 직선거리(km) 중 최댓값 — 해당 월 배정 접수 중 좌표 있음 */
    maxKmFromJuan: number;
    /** 동일 조건 건 중 좌표 있는 건의 거리 합(km) */
    sumKmFromJuan: number;
  }>;
  /** 오늘 팀장 휴무 등록(재직 중) */
  teamLeaderDayOffToday: Array<{ teamLeaderId: string; name: string }>;
  /** 일일 명단 모드(useDailyRosterOnly)에서 오늘 명단에 안 올린 팀원(조장 배정 명단 제외 = 쉼) */
  teamMembersDailyRosterRestToday: Array<{ teamMemberId: string; name: string }>;
  /** 크루 그룹 중 일일 명단 모드 사용 여부 — false면 우측 안내 표시 */
  dailyRosterModeActive: boolean;
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
