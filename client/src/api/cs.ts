import { API } from './apiPrefix';
import { resolveInitialTenantSlug } from '../utils/tenantHostResolve';

function authHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export interface CsReport {
  id: string;
  customerName: string;
  customerPhone: string;
  content: string;
  /** 1~5, 고객 별점 (구버전 건은 null) */
  serviceRating: number | null;
  imageUrls: string[];
  status: string;
  memo: string | null;
  createdAt: string;
  inquiryId?: string | null;
  completedAt?: string | null;
  completedBy?: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
  completionMethod?: string | null;
  inquiry?: {
    id: string;
    inquiryNumber?: string | null;
    customerName: string;
    customerPhone: string;
    customerPhone2?: string | null;
    address: string;
    addressDetail?: string | null;
    status: string;
    preferredDate?: string | null;
    preferredTime?: string | null;
    preferredTimeDetail?: string | null;
    memo?: string | null;
    claimMemo?: string | null;
    areaPyeong?: number | null;
    areaBasis?: string | null;
    exclusiveAreaSqm?: number | null;
    propertyType?: string | null;
    roomCount?: number | null;
    bathroomCount?: number | null;
    balconyCount?: number | null;
    kitchenCount?: number | null;
    buildingType?: string | null;
    moveInDate?: string | null;
    specialNotes?: string | null;
    scheduleMemo?: string | null;
    crewMemberCount?: number | null;
    crewMemberNote?: string | null;
    source?: string | null;
    createdAt?: string;
    assignments: Array<{ teamLeader: { id: string; name: string } }>;
  } | null;
  /** 관리자가 팀장/타업체 계정으로 전달한 경우 */
  forwardedToUser?: {
    id: string;
    name: string;
    role?: string;
    externalCompanyId?: string | null;
    externalCompany?: { id: string; name: string } | null;
  } | null;
  /** A/S(재방문 등) 예정일 ISO — 관리 스케줄 표시용 */
  asServiceDate?: string | null;
}

/** 공개: 이미지 업로드 */
export async function uploadCsImage(file: File): Promise<{ url: string }> {
  const form = new FormData();
  form.append('image', file);
  const res = await fetch(`${API}/cs/upload`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '이미지 업로드에 실패했습니다.');
  }
  return res.json();
}

/** 공개: C/S 제출 */
export async function submitCsReport(data: {
  customerName: string;
  customerPhone: string;
  content: string;
  /** 1~5 서비스 품질 별점 */
  serviceRating: number;
  imageUrls?: string[];
}): Promise<{ ok: boolean; id: string; inquiryId?: string }> {
  const tenantSlug = resolveInitialTenantSlug();
  const res = await fetch(`${API}/cs/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...data, ...(tenantSlug ? { tenantSlug } : {}) }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '제출에 실패했습니다.');
  }
  return res.json();
}

/** 관리자·마케터: 미처리(접수) C/S 건수 */
export async function getCsPendingCount(token: string): Promise<{ count: number }> {
  const res = await fetch(`${API}/cs/pending-count`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error('C/S 건수를 불러올 수 없습니다.');
  return res.json();
}

export type CsListDatePreset = 'last3months' | 'month' | 'day';

function mapCsReportItem(i: CsReport): CsReport {
  return {
    ...i,
    imageUrls: Array.isArray(i.imageUrls) ? i.imageUrls : [],
    serviceRating: typeof i.serviceRating === 'number' ? i.serviceRating : null,
  };
}

/** 관리자: C/S 목록 */
export async function getCsReports(
  token: string,
  params?: {
    datePreset?: CsListDatePreset;
    month?: string;
    day?: string;
    limit?: number;
    offset?: number;
  }
): Promise<{ items: CsReport[]; total: number }> {
  const q = new URLSearchParams();
  if (params?.datePreset) q.set('datePreset', params.datePreset);
  if (params?.month) q.set('month', params.month);
  if (params?.day) q.set('day', params.day);
  if (params?.limit != null) q.set('limit', String(params.limit));
  if (params?.offset != null) q.set('offset', String(params.offset));
  const qs = q.toString();
  const res = await fetch(`${API}/cs${qs ? `?${qs}` : ''}`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error('C/S 목록을 불러올 수 없습니다.');
  const json = await res.json();
  return {
    items: (json.items || []).map((i: CsReport) => mapCsReportItem(i)),
    total: typeof json.total === 'number' ? json.total : (json.items || []).length,
  };
}

/** 관리자: C/S 상세 */
export async function getCsReport(token: string, id: string): Promise<CsReport> {
  const res = await fetch(`${API}/cs/${id}`, { headers: authHeaders(token) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'C/S를 찾을 수 없습니다.');
  }
  const i = await res.json();
  return {
    ...i,
    imageUrls: Array.isArray(i.imageUrls) ? i.imageUrls : [],
    serviceRating: typeof i.serviceRating === 'number' ? i.serviceRating : i.serviceRating ?? null,
  };
}

/** 관리자·마케터: C/S 상세 확인 — 접수 건은 처리중으로 전환(미확인 배지 해제) */
export async function acknowledgeCsReport(token: string, id: string): Promise<CsReport> {
  const res = await fetch(`${API}/cs/${encodeURIComponent(id)}/acknowledge`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'C/S 확인에 실패했습니다.');
  }
  const i = await res.json();
  return mapCsReportItem(i);
}

/** 관리자·마케터: C/S 상태/메모/처리완료 */
export async function updateCsReport(
  token: string,
  id: string,
  data: {
    status?: string;
    memo?: string | null;
    completionMethod?: string | null;
    asServiceDate?: string | null;
  }
): Promise<CsReport> {
  const res = await fetch(`${API}/cs/${id}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '수정에 실패했습니다.');
  }
  const i = await res.json();
  return {
    ...i,
    imageUrls: Array.isArray(i.imageUrls) ? i.imageUrls : [],
    serviceRating: typeof i.serviceRating === 'number' ? i.serviceRating : i.serviceRating ?? null,
  };
}

/** 관리자·마케터: C/S를 팀장/타업체 계정에 전달(또는 전달 해제). userId null·빈 문자열이면 해제 */
export async function forwardCsReport(
  token: string,
  id: string,
  userId: string | null
): Promise<CsReport> {
  const res = await fetch(`${API}/cs/${encodeURIComponent(id)}/forward`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ userId: userId && userId.trim() ? userId.trim() : null }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || '전달에 실패했습니다.');
  }
  const i = await res.json();
  return {
    ...i,
    imageUrls: Array.isArray(i.imageUrls) ? i.imageUrls : [],
    serviceRating: typeof i.serviceRating === 'number' ? i.serviceRating : i.serviceRating ?? null,
  };
}

/** 관리자 전용 — 비밀번호 확인 후 C/S 영구 삭제 */
export async function deleteCsReport(token: string, id: string, password: string): Promise<void> {
  const res = await fetch(`${API}/cs/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(token),
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '삭제에 실패했습니다.');
  }
}
