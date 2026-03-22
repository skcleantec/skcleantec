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
  morningCount: number;
  afternoonCount: number;
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
