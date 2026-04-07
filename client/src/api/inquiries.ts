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
    /** 관리자만: 해당 사용자 기준 접수(또는 발주서 작성자). `__unassigned__`는 미지정만 */
    createdById?: string;
    /** 배정 팀장. `__unassigned__`는 미배정만 */
    teamLeaderId?: string;
    /** 예약일(희망일) 월 단위 YYYY-MM, KST */
    scheduleMonth?: string;
    /** 예약일(희망일) 하루 YYYY-MM-DD, KST (scheduleMonth보다 우선) */
    scheduleDay?: string;
  }
) {
  const q = new URLSearchParams();
  if (params?.status) q.set('status', params.status);
  if (params?.search) q.set('search', params.search);
  if (params?.datePreset) q.set('datePreset', params.datePreset);
  if (params?.month) q.set('month', params.month);
  if (params?.day) q.set('day', params.day);
  if (params?.createdById) q.set('createdById', params.createdById);
  if (params?.teamLeaderId) q.set('teamLeaderId', params.teamLeaderId);
  if (params?.scheduleMonth) q.set('scheduleMonth', params.scheduleMonth);
  if (params?.scheduleDay) q.set('scheduleDay', params.scheduleDay);
  const qs = q.toString();
  const res = await fetch(`${API}/inquiries${qs ? `?${qs}` : ''}`, {
    headers: headers(token),
  });
  if (!res.ok) throw new Error('문의 목록을 불러올 수 없습니다.');
  return res.json();
}

/** 단일 접수 (목록 항목과 동일 형태) — 딥링크 등 */
export async function getInquiry(token: string, id: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${API}/inquiries/${encodeURIComponent(id)}`, {
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '문의를 불러올 수 없습니다.');
  }
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

/** 관리자 전용 — 비밀번호 확인 후 접수 영구 삭제 */
export async function deleteInquiry(token: string, id: string, password: string): Promise<void> {
  const res = await fetch(`${API}/inquiries/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: headers(token),
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || '삭제에 실패했습니다.');
  }
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
