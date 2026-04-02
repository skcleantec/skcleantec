const API = '/api';

function headers(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function getMyDayOffs(
  token: string,
  start: string,
  end: string
): Promise<{ items: string[] }> {
  const q = new URLSearchParams({ start, end }).toString();
  const res = await fetch(`${API}/dayoffs/me?${q}`, { headers: headers(token) });
  if (!res.ok) throw new Error('휴무일을 불러올 수 없습니다.');
  return res.json();
}

export async function addDayOff(token: string, date: string): Promise<void> {
  const res = await fetch(`${API}/dayoffs/me`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ date }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '휴무일 추가에 실패했습니다.');
  }
}

export async function removeDayOff(token: string, date: string): Promise<void> {
  const q = new URLSearchParams({ date }).toString();
  const res = await fetch(`${API}/dayoffs/me?${q}`, {
    method: 'DELETE',
    headers: headers(token),
  });
  if (!res.ok) throw new Error('휴무일 삭제에 실패했습니다.');
}

export interface ScheduleStatsByDate {
  offCount: number;
  offNames: string[];
  workingCount: number;
  totalTeamLeaders: number;
  assignedCount: number;
  availableNames: string[];
  availableMorningNames?: string[];
  availableAfternoonNames?: string[];
  /** 해당일 오전 슬롯에 배정 가능한 팀장 id (스케줄 상세 담당자 선택용) */
  availableMorningLeaderIds?: string[];
  /** 해당일 오후 슬롯에 배정 가능한 팀장 id */
  availableAfternoonLeaderIds?: string[];
  /** 오전 슬롯 소진 건수 */
  morningOccupied?: number;
  /** 오후 슬롯 소진 건수 */
  afternoonOccupied?: number;
  /** 사이청소 옵션 접수 건수(해당일) */
  sideCleaningOrderCount?: number;
  /** 사이청소 중 오전/오후 미확정 건수 */
  sideCleaningUnconfirmedCount?: number;
  /** 남은 슬롯 합: 오전+오후 (휴무 반영) */
  unassignedTotal?: number;
  assignableMorning?: number;
  assignableAfternoonSlot?: number;
}

export async function getScheduleStats(
  token: string,
  start: string,
  end: string
): Promise<{ byDate: Record<string, ScheduleStatsByDate> }> {
  const q = new URLSearchParams({ start, end }).toString();
  const res = await fetch(`${API}/dayoffs/schedule-stats?${q}`, {
    headers: headers(token),
  });
  if (!res.ok) throw new Error('스케줄 현황을 불러올 수 없습니다.');
  return res.json();
}
