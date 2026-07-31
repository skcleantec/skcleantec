import { API } from './apiPrefix';

export type ScheduleAlertKind = 'date' | 'cancel';

export type ScheduleAlertItem = {
  id: string;
  changeLogId: string;
  inquiryId: string | null;
  customerName: string;
  kind: ScheduleAlertKind;
  summaryLine: string;
  lines: string[];
  createdAt: string;
  actorName: string | null;
  preferredDate: string | null;
};

export async function getScheduleAlertUnseenCount(
  token: string,
  team = false,
): Promise<{ count: number }> {
  const base = team ? `${API}/team/schedule-alerts/unseen-count` : `${API}/schedule-alerts/unseen-count`;
  const res = await fetch(base, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('일정 알림 수를 불러오지 못했습니다.');
  return res.json() as Promise<{ count: number }>;
}

export async function getScheduleAlertPending(
  token: string,
  opts?: { limit?: number; team?: boolean },
): Promise<{ items: ScheduleAlertItem[]; total: number }> {
  const team = opts?.team ?? false;
  const q = opts?.limit ? `?limit=${opts.limit}` : '';
  const base = team ? `${API}/team/schedule-alerts/pending${q}` : `${API}/schedule-alerts/pending${q}`;
  const res = await fetch(base, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('일정 알림 목록을 불러오지 못했습니다.');
  return res.json() as Promise<{ items: ScheduleAlertItem[]; total: number }>;
}

export async function ackScheduleAlert(
  token: string,
  changeLogId: string,
  team = false,
): Promise<void> {
  const base = team
    ? `${API}/team/schedule-alerts/${encodeURIComponent(changeLogId)}/ack`
    : `${API}/schedule-alerts/${encodeURIComponent(changeLogId)}/ack`;
  const res = await fetch(base, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('확인 처리에 실패했습니다.');
}

export async function ackAllScheduleAlerts(token: string, team = false): Promise<void> {
  const base = team ? `${API}/team/schedule-alerts/ack-all` : `${API}/schedule-alerts/ack-all`;
  const res = await fetch(base, { method: 'POST', headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('전체 확인 처리에 실패했습니다.');
}
