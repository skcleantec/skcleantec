import type { OrderFollowupStatus } from '../constants/orderFollowupStatus';
import { API } from './apiPrefix';

function headers(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function readError(res: Response): Promise<string> {
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (typeof data.error === 'string' && data.error.trim()) return data.error;
  } else {
    const text = await res.text().catch(() => '');
    if (text.trim()) return text.trim().slice(0, 200);
  }
  return res.statusText?.trim() ? `${res.status} ${res.statusText}` : '요청에 실패했습니다.';
}

export interface OrderFollowupUserBrief {
  id: string;
  name: string;
  email: string;
  role: string;
}

export type OrderFollowupDatePreset = 'today' | 'all' | 'month' | 'day';

export interface OrderFollowupItem {
  id: string;
  customerName: string;
  customerPhone: string;
  status: OrderFollowupStatus;
  deferCount: number;
  goldDb: boolean;
  memo: string | null;
  nextContactAt: string | null;
  depositReceivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: OrderFollowupUserBrief;
  handledBy: OrderFollowupUserBrief | null;
}

export interface OrderFollowupLogItem {
  id: string;
  followupId: string;
  action: string;
  detail: string | null;
  createdAt: string;
  actor: OrderFollowupUserBrief;
}

export async function listOrderFollowups(
  token: string,
  opts?: {
    includeFulfilled?: boolean;
    status?: OrderFollowupStatus | '';
    customerName?: string;
    /** 등록일(createdAt) 기준 — 접수 목록과 동일 KST 구간 */
    datePreset?: OrderFollowupDatePreset;
    month?: string;
    day?: string;
  }
): Promise<{ items: OrderFollowupItem[] }> {
  const q = new URLSearchParams();
  if (opts?.includeFulfilled) q.set('includeFulfilled', '1');
  if (opts?.status) q.set('status', opts.status);
  if (opts?.customerName?.trim()) q.set('customerName', opts.customerName.trim());
  if (opts?.datePreset && opts.datePreset !== 'all') {
    q.set('datePreset', opts.datePreset);
    if (opts.datePreset === 'month' && opts.month?.trim()) q.set('month', opts.month.trim());
    if (opts.datePreset === 'day' && opts.day?.trim()) q.set('day', opts.day.trim());
  }
  const qs = q.toString();
  const res = await fetch(`${API}/order-followups${qs ? `?${qs}` : ''}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function createOrderFollowup(
  token: string,
  body: {
    customerName: string;
    /** 비우면 저장 시 빈 문자열(미입력) */
    customerPhone?: string;
    status?: OrderFollowupStatus;
    memo?: string | null;
    nextContactAt?: string | null;
    goldDb?: boolean;
  }
): Promise<{ item: OrderFollowupItem }> {
  const res = await fetch(`${API}/order-followups`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function patchOrderFollowup(
  token: string,
  id: string,
  body: {
    status?: OrderFollowupStatus;
    memo?: string | null;
    nextContactAt?: string | null;
    goldDb?: boolean;
  }
): Promise<{ item: OrderFollowupItem }> {
  const res = await fetch(`${API}/order-followups/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function deferOrderFollowup(
  token: string,
  id: string,
  note?: string
): Promise<{ item: OrderFollowupItem }> {
  const res = await fetch(`${API}/order-followups/${encodeURIComponent(id)}/defer`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ note: note ?? '' }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function deleteOrderFollowup(
  token: string,
  id: string,
  password: string
): Promise<{ ok: true }> {
  const res = await fetch(`${API}/order-followups/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: headers(token),
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function listOrderFollowupLogs(
  token: string,
  id: string
): Promise<{ items: OrderFollowupLogItem[] }> {
  const res = await fetch(`${API}/order-followups/${encodeURIComponent(id)}/logs`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}
