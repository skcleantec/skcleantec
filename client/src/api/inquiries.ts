const API = '/api';

function headers(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export type MarketerOverviewResponse = {
  monthKey: string;
  todayYmd: string;
  marketers: Array<{
    marketerId: string;
    name: string;
    monthCount: number;
    todayCount: number;
  }>;
};

/** 마케터별 이번 달·오늘 접수 건수 (접수일 KST, 목록 필터와 무관) */
export async function getMarketerOverview(token: string): Promise<MarketerOverviewResponse> {
  const res = await fetch(`${API}/inquiries/marketer-overview`, {
    headers: headers(token),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    const fromServer = typeof body.error === 'string' && body.error.trim() ? body.error.trim() : null;
    if (fromServer) throw new Error(fromServer);
    throw new Error(`마케터별 집계를 불러올 수 없습니다. (HTTP ${res.status})`);
  }
  return res.json() as Promise<MarketerOverviewResponse>;
}

export async function getInquiries(
  token: string,
  params?: {
    status?: string;
    search?: string;
    /** 접수일(createdAt) 기준 — today: 당일(KST), all: 제한 없음, month: month(YYYY-MM), day: day(YYYY-MM-DD) */
    datePreset?: 'today' | 'all' | 'month' | 'day';
    month?: string;
    day?: string;
  }
) {
  const q = new URLSearchParams();
  if (params?.status) q.set('status', params.status);
  if (params?.search) q.set('search', params.search);
  if (params?.datePreset) q.set('datePreset', params.datePreset);
  if (params?.month) q.set('month', params.month);
  if (params?.day) q.set('day', params.day);
  const qs = q.toString();
  const res = await fetch(`${API}/inquiries${qs ? `?${qs}` : ''}`, {
    headers: headers(token),
  });
  if (!res.ok) throw new Error('문의 목록을 불러올 수 없습니다.');
  return res.json();
}

export async function updateInquiry(
  token: string,
  id: string,
  data: Record<string, unknown>
) {
  const res = await fetch(`${API}/inquiries/${id}`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '수정에 실패했습니다.');
  }
  return res.json();
}

export async function createInquiry(token: string, data: Record<string, unknown>) {
  const res = await fetch(`${API}/inquiries`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '등록에 실패했습니다.');
  }
  return res.json();
}
