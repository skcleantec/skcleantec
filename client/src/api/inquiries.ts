import { API } from './apiPrefix';

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

/** 마케터별 이번 달·오늘 예약완료(RECEIVED) 건수 — 서비스접수 목록과 동일(접수일 KST) */
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

export type MarketerDailyOverviewResponse = {
  marketerId: string;
  marketerName: string;
  monthKey: string;
  daysInMonth: number;
  dailyCounts: number[];
  monthTotal: number;
};

/** 마케터별 월간 일별 예약완료 건수 (접수일 KST, 서비스접수와 동일) */
export async function getMarketerDailyOverview(
  token: string,
  params: { marketerId: string; month: string }
): Promise<MarketerDailyOverviewResponse> {
  const q = new URLSearchParams({
    marketerId: params.marketerId,
    month: params.month,
  });
  const res = await fetch(`${API}/inquiries/marketer-daily-overview?${q}`, {
    headers: headers(token),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    const fromServer = typeof body.error === 'string' && body.error.trim() ? body.error.trim() : null;
    if (fromServer) throw new Error(fromServer);
    throw new Error(`일별 접수 집계를 불러올 수 없습니다. (HTTP ${res.status})`);
  }
  return res.json() as Promise<MarketerDailyOverviewResponse>;
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
    /** 마케터 일별 집계와 동일 기준(KST 하루). createdById와 함께 사용 */
    marketerStatsDay?: string;
    /** 배정 팀장. `__unassigned__`는 미배정만 */
    teamLeaderId?: string;
    /** 영업 브랜드(Operating Company) UUID */
    operatingCompanyId?: string;
    /** 예약일(희망일) 월 단위 YYYY-MM, KST */
    scheduleMonth?: string;
    /** 예약일(희망일) 하루 YYYY-MM-DD, KST (scheduleMonth보다 우선) */
    scheduleDay?: string;
    /** 관리자: 현장 검수 상태 NONE|IN_PROGRESS|COMPLETED|VOID */
    inspectionStatus?: string;
    fromYmd?: string;
    toYmd?: string;
    kstHour?: number;
    statusEvent?: string;
    limit?: number;
    offset?: number;
  }
) {
  const q = new URLSearchParams();
  if (params?.status) q.set('status', params.status);
  if (params?.search) q.set('search', params.search);
  if (params?.fromYmd?.trim() && params?.toYmd?.trim()) {
    q.set('fromYmd', params.fromYmd.trim());
    q.set('toYmd', params.toYmd.trim());
  } else if (params?.datePreset) q.set('datePreset', params.datePreset);
  if (params?.month) q.set('month', params.month);
  if (params?.day) q.set('day', params.day);
  if (params?.kstHour != null && params.kstHour >= 0 && params.kstHour <= 23) {
    q.set('kstHour', String(params.kstHour));
  }
  if (params?.statusEvent?.trim()) q.set('statusEvent', params.statusEvent.trim());
  if (params?.limit != null) q.set('limit', String(params.limit));
  if (params?.offset != null) q.set('offset', String(params.offset));
  if (params?.createdById) q.set('createdById', params.createdById);
  if (params?.marketerStatsDay) q.set('marketerStatsDay', params.marketerStatsDay);
  if (params?.teamLeaderId) q.set('teamLeaderId', params.teamLeaderId);
  if (params?.operatingCompanyId) q.set('operatingCompanyId', params.operatingCompanyId);
  if (params?.scheduleMonth) q.set('scheduleMonth', params.scheduleMonth);
  if (params?.scheduleDay) q.set('scheduleDay', params.scheduleDay);
  if (params?.inspectionStatus) q.set('inspectionStatus', params.inspectionStatus);
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

/** 같은 예약일(KST) 접수 간 팀원 이름 교환 — 상세 form과 동일 응답 */
export async function swapInquiryCrewWithPartner(
  token: string,
  inquiryId: string,
  params: {
    partnerInquiryId: string;
    myCrewName?: string;
    partnerCrewName?: string;
  }
): Promise<Record<string, unknown>> {
  const res = await fetch(
    `${API}/inquiries/${encodeURIComponent(inquiryId)}/swap-crew-with-partner`,
    {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify(params),
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '팀원 맞바꿈에 실패했습니다.');
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

/** 관리자 전용 — 접수일(createdAt) KST 해당 일 전체 삭제 */
export async function bulkDeleteInquiriesByDay(
  token: string,
  day: string,
  password: string
): Promise<{ deleted: number }> {
  const res = await fetch(`${API}/inquiries/admin/bulk-delete-by-day`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ day, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || '삭제에 실패했습니다.');
  }
  return data as { deleted: number };
}

/** 관리자 전용 — 접수일(createdAt) KST 해당 월 전체 삭제 */
export async function bulkDeleteInquiriesByMonth(
  token: string,
  month: string,
  password: string
): Promise<{ deleted: number }> {
  const res = await fetch(`${API}/inquiries/admin/bulk-delete-by-month`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ month, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || '삭제에 실패했습니다.');
  }
  return data as { deleted: number };
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
