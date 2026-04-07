const API = '/api';

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
    assignments: Array<{ teamLeader: { id: string; name: string } }>;
  } | null;
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
  const res = await fetch(`${API}/cs/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
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

/** 관리자: C/S 목록 */
export async function getCsReports(token: string): Promise<{ items: CsReport[] }> {
  const res = await fetch(`${API}/cs`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error('C/S 목록을 불러올 수 없습니다.');
  const json = await res.json();
  return {
    items: (json.items || []).map((i: CsReport) => ({
      ...i,
      imageUrls: Array.isArray(i.imageUrls) ? i.imageUrls : [],
      serviceRating: typeof i.serviceRating === 'number' ? i.serviceRating : null,
    })),
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

/** 관리자·마케터: C/S 상태/메모/처리완료 */
export async function updateCsReport(
  token: string,
  id: string,
  data: { status?: string; memo?: string | null; completionMethod?: string | null }
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
