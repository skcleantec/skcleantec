import { API, apiErrorMessage } from './apiPrefix';
import { getPlatformToken } from '../stores/platformAuth';

export const PLATFORM_SUPPORT_THREAD_KEY = 'platform-support';

export type PlatformSupportSenderKind = 'PLATFORM' | 'TENANT';

export type PlatformSupportMessageDto = {
  id: string;
  body: string;
  senderKind: PlatformSupportSenderKind;
  senderName: string;
  senderRoleLabel: string | null;
  broadcastBatchId: string | null;
  createdAt: string;
};

export type PlatformSupportThreadDto = {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  lastMessageAt: string | null;
  lastMessagePreview: string;
  lastSenderKind: PlatformSupportSenderKind | null;
  waitingOn: 'PLATFORM' | 'TENANT' | null;
  unreadCount: number;
  messages: PlatformSupportMessageDto[];
};

export type PlatformSupportThreadListItem = {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  lastMessageAt: string;
  lastMessagePreview: string;
  lastSenderKind: PlatformSupportSenderKind | null;
  waitingOn: 'PLATFORM' | 'TENANT' | null;
  unread: boolean;
};

export type PlatformSupportSummary = {
  id: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string;
  unreadCount: number;
};

function tenantHeaders(token: string) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

function platformHeaders() {
  const token = getPlatformToken();
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` };
}

export async function getTenantSupportSummary(token: string): Promise<PlatformSupportSummary> {
  const res = await fetch(`${API}/support-messages/summary`, { headers: tenantHeaders(token) });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '운영팀 대화를 불러올 수 없습니다.'));
  return res.json();
}

export async function getTenantSupportThread(token: string): Promise<PlatformSupportThreadDto> {
  const res = await fetch(`${API}/support-messages/thread`, { headers: tenantHeaders(token) });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '운영팀 대화를 불러올 수 없습니다.'));
  return res.json();
}

export async function sendTenantSupportMessage(token: string, body: string): Promise<PlatformSupportMessageDto> {
  const res = await fetch(`${API}/support-messages/messages`, {
    method: 'POST',
    headers: tenantHeaders(token),
    body: JSON.stringify({ body }),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '메시지 전송에 실패했습니다.'));
  return res.json();
}

export async function getPlatformSupportUnreadCount(): Promise<number> {
  const res = await fetch(`${API}/platform/support-messages/unread-count`, { headers: platformHeaders() });
  if (!res.ok) return 0;
  const body = (await res.json()) as { count?: number };
  return body.count ?? 0;
}

export async function listPlatformSupportTenants(q?: string): Promise<{ id: string; name: string; slug: string }[]> {
  const qs = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
  const res = await fetch(`${API}/platform/support-messages/tenants${qs}`, { headers: platformHeaders() });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '업체 목록을 불러올 수 없습니다.'));
  const body = (await res.json()) as { items: { id: string; name: string; slug: string }[] };
  return body.items;
}

export async function listPlatformSupportThreads(params: {
  q?: string;
  waiting?: 'PLATFORM' | 'TENANT' | 'all';
  unreadOnly?: boolean;
  limit: number;
  offset: number;
}): Promise<{ items: PlatformSupportThreadListItem[]; total: number }> {
  const q = new URLSearchParams();
  if (params.q) q.set('q', params.q);
  if (params.waiting && params.waiting !== 'all') q.set('waiting', params.waiting);
  if (params.unreadOnly) q.set('unreadOnly', '1');
  q.set('limit', String(params.limit));
  q.set('offset', String(params.offset));
  const res = await fetch(`${API}/platform/support-messages/threads?${q}`, { headers: platformHeaders() });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '메시지 목록을 불러올 수 없습니다.'));
  return res.json();
}

export async function getPlatformSupportThread(tenantId: string): Promise<PlatformSupportThreadDto> {
  const res = await fetch(`${API}/platform/support-messages/threads/${encodeURIComponent(tenantId)}`, {
    headers: platformHeaders(),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '대화를 불러올 수 없습니다.'));
  return res.json();
}

export async function sendPlatformSupportMessage(tenantId: string, body: string): Promise<PlatformSupportMessageDto> {
  const res = await fetch(`${API}/platform/support-messages/threads/${encodeURIComponent(tenantId)}/messages`, {
    method: 'POST',
    headers: platformHeaders(),
    body: JSON.stringify({ body }),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '메시지 전송에 실패했습니다.'));
  return res.json();
}

export async function broadcastPlatformSupportMessage(
  body: string,
  tenantIds?: string[],
): Promise<{ batchId: string; sent: number }> {
  const res = await fetch(`${API}/platform/support-messages/broadcast`, {
    method: 'POST',
    headers: platformHeaders(),
    body: JSON.stringify({ body, tenantIds }),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '단체 발송에 실패했습니다.'));
  return res.json();
}
