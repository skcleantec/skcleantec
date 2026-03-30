const API = '/api';

function headers(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export interface AdChannel {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

export async function getAdChannels(token: string, all?: boolean): Promise<{ items: AdChannel[] }> {
  const q = all ? '?all=1' : '';
  const res = await fetch(`${API}/advertising/channels${q}`, { headers: headers(token) });
  if (!res.ok) throw new Error('채널 목록을 불러올 수 없습니다.');
  return res.json();
}

export async function createAdChannel(token: string, name: string, sortOrder?: number): Promise<AdChannel> {
  const res = await fetch(`${API}/advertising/channels`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ name, sortOrder }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || '채널 추가에 실패했습니다.');
  }
  return res.json();
}

export async function updateAdChannel(
  token: string,
  id: string,
  data: { name?: string; isActive?: boolean; sortOrder?: number }
): Promise<AdChannel> {
  const res = await fetch(`${API}/advertising/channels/${id}`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || '채널 수정에 실패했습니다.');
  }
  return res.json();
}

export async function reorderAdChannels(token: string, orderedIds: string[]): Promise<{ ok: boolean }> {
  const res = await fetch(`${API}/advertising/channels/reorder`, {
    method: 'PUT',
    headers: headers(token),
    body: JSON.stringify({ orderedIds }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || '순서 저장에 실패했습니다.');
  }
  return res.json();
}

export async function deleteAdChannel(token: string, id: string, password: string): Promise<{ ok: boolean }> {
  const res = await fetch(`${API}/advertising/channels/${id}`, {
    method: 'DELETE',
    headers: headers(token),
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || '삭제에 실패했습니다.');
  }
  return res.json();
}

export interface ActiveSession {
  id: string;
  userId: string;
  startedAt: string;
  endedAt: string | null;
}

export async function getActiveAdSession(token: string): Promise<{ session: ActiveSession | null }> {
  const res = await fetch(`${API}/advertising/sessions/active`, { headers: headers(token) });
  if (!res.ok) throw new Error('세션 정보를 불러올 수 없습니다.');
  return res.json();
}

export async function startAdSession(token: string): Promise<ActiveSession> {
  const res = await fetch(`${API}/advertising/sessions/start`, {
    method: 'POST',
    headers: headers(token),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || '시작할 수 없습니다.');
  }
  return res.json();
}

export async function endAdSession(
  token: string,
  lines: { channelId: string; amount: number }[]
): Promise<{ session: unknown }> {
  const res = await fetch(`${API}/advertising/sessions/end`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ lines }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || '종료 처리에 실패했습니다.');
  }
  return res.json();
}

export interface AdvertisingAnalytics {
  period: { from: string; to: string; days: number };
  summary: {
    totalAdSpend: number;
    orderInquiryCount: number;
    totalRevenue: number;
    roas: number | null;
    costPerInquiry: number | null;
    avgDailySpend: number;
  };
  byUser: {
    userId: string;
    name: string;
    email: string;
    role: string;
    totalAdSpend: number;
    orderInquiryCount: number;
    totalRevenue: number;
    roas: number | null;
    costPerInquiry: number | null;
    avgDailySpend: number;
  }[];
}

export async function getAdvertisingAnalytics(
  token: string,
  from: string,
  to: string,
  marketerId?: string | null
): Promise<AdvertisingAnalytics> {
  const q = new URLSearchParams({ from, to });
  if (marketerId) q.set('marketerId', marketerId);
  const res = await fetch(`${API}/advertising/analytics?${q}`, { headers: headers(token) });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || '집계를 불러올 수 없습니다.');
  }
  return res.json();
}

export interface HistorySession {
  id: string;
  userId: string;
  startedAt: string;
  endedAt: string | null;
  spendLines: { amount: number; channel: AdChannel }[];
  user: { id: string; name: string; email: string; role: string };
}

export async function getAdSessionHistory(
  token: string,
  from: string,
  to: string,
  marketerId?: string | null
): Promise<{ items: HistorySession[] }> {
  const q = new URLSearchParams({ from, to });
  if (marketerId) q.set('marketerId', marketerId);
  const res = await fetch(`${API}/advertising/sessions/history?${q}`, { headers: headers(token) });
  if (!res.ok) throw new Error('이력을 불러올 수 없습니다.');
  return res.json();
}
