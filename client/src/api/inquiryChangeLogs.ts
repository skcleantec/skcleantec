import { API } from './apiPrefix';

export type ChangeLogCategory = 'date' | 'cost' | 'extra' | 'team' | 'status' | 'etc';

export interface ChangeHistoryItem {
  id: string;
  inquiryId: string | null;
  customerName: string;
  createdAt: string;
  actorName: string | null;
  summaryLine: string;
  lines: string[];
  categories: ChangeLogCategory[];
}

export interface UnseenChangeCount {
  count: number;
  seenAt: string | null;
  latestAt: string | null;
}

export async function getUnseenChangeCount(token: string): Promise<UnseenChangeCount> {
  const res = await fetch(`${API}/inquiry-change-logs/unseen-count`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || '미확인 변경 수를 불러올 수 없습니다.');
  }
  return res.json();
}

export async function markChangeSeen(token: string): Promise<{ ok: boolean; seenAt: string }> {
  const res = await fetch(`${API}/inquiry-change-logs/mark-seen`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || '확인 처리에 실패했습니다.');
  }
  return res.json();
}

/** 팀장 전용 — 본인 담당 접수의 변경 이력 */
export async function getTeamUnseenChangeCount(token: string): Promise<UnseenChangeCount> {
  const res = await fetch(`${API}/team/inquiry-change-logs/unseen-count`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || '미확인 변경 수를 불러올 수 없습니다.');
  }
  return res.json();
}

export async function markTeamChangeSeen(token: string): Promise<{ ok: boolean; seenAt: string }> {
  const res = await fetch(`${API}/team/inquiry-change-logs/mark-seen`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || '확인 처리에 실패했습니다.');
  }
  return res.json();
}

export async function getTeamChangeHistoryList(
  token: string,
  opts: { limit?: number; offset?: number }
): Promise<{ items: ChangeHistoryItem[]; total: number }> {
  const q = new URLSearchParams();
  if (opts.limit != null) q.set('limit', String(opts.limit));
  if (opts.offset != null) q.set('offset', String(opts.offset));
  const res = await fetch(`${API}/team/inquiry-change-logs?${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || '변경 이력을 불러올 수 없습니다.');
  }
  return res.json();
}

export async function getRecentChangeHistory(token: string, limit = 10): Promise<{ items: ChangeHistoryItem[] }> {
  const res = await fetch(`${API}/inquiry-change-logs/recent?limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || '변경 이력을 불러올 수 없습니다.');
  }
  return res.json();
}

export async function getChangeHistoryList(
  token: string,
  opts: { customerName?: string; limit?: number; offset?: number }
): Promise<{ items: ChangeHistoryItem[]; total: number }> {
  const q = new URLSearchParams();
  if (opts.customerName?.trim()) q.set('customerName', opts.customerName.trim());
  if (opts.limit != null) q.set('limit', String(opts.limit));
  if (opts.offset != null) q.set('offset', String(opts.offset));
  const res = await fetch(`${API}/inquiry-change-logs?${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || '변경 이력을 불러올 수 없습니다.');
  }
  return res.json();
}

export async function deleteChangeHistoryEntry(token: string, id: string, password: string): Promise<void> {
  const res = await fetch(`${API}/inquiry-change-logs/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || '삭제에 실패했습니다.');
  }
}
