import { API } from './apiPrefix';

function headers(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export type InquiryTrashItem = {
  id: string;
  customerName: string;
  inquiryNumber: string | null;
  customerPhone: string;
  address: string;
  status: string;
  deletedAt: string;
  deletedBy: { id: string; name: string } | null;
  purgeAt: string;
  daysRemaining: number;
  retentionDays: number;
};

export async function getInquiryTrashList(
  token: string,
  params?: {
    limit?: number;
    offset?: number;
    search?: string;
    datePreset?: 'today' | 'all' | 'month' | 'day';
    month?: string;
    day?: string;
  },
): Promise<{ items: InquiryTrashItem[]; total: number; retentionDays: number }> {
  const q = new URLSearchParams();
  if (params?.limit != null) q.set('limit', String(params.limit));
  if (params?.offset != null) q.set('offset', String(params.offset));
  if (params?.search?.trim()) q.set('search', params.search.trim());
  if (params?.datePreset) q.set('datePreset', params.datePreset);
  if (params?.month) q.set('month', params.month);
  if (params?.day) q.set('day', params.day);
  const res = await fetch(`${API}/inquiries/trash?${q}`, { headers: headers(token) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || '휴지통 목록을 불러올 수 없습니다.');
  }
  return data as { items: InquiryTrashItem[]; total: number; retentionDays: number };
}

export async function restoreInquiryFromTrash(
  token: string,
  id: string,
  password: string,
): Promise<void> {
  const res = await fetch(`${API}/inquiries/trash/${encodeURIComponent(id)}/restore`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || '복구에 실패했습니다.');
  }
}

export async function purgeInquiryFromTrash(
  token: string,
  id: string,
  password: string,
): Promise<void> {
  const res = await fetch(`${API}/inquiries/trash/${encodeURIComponent(id)}/purge`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || '영구 삭제에 실패했습니다.');
  }
}
