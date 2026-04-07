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
  imageUrls: string[];
  status: string;
  memo: string | null;
  createdAt: string;
  inquiryId?: string | null;
  inquiry?: {
    id: string;
    inquiryNumber?: string | null;
    customerName: string;
    customerPhone: string;
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

/** 관리자: C/S 목록 */
export async function getCsReports(token: string): Promise<{ items: CsReport[] }> {
  const res = await fetch(`${API}/cs`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error('C/S 목록을 불러올 수 없습니다.');
  const json = await res.json();
  return { items: (json.items || []).map((i: CsReport) => ({ ...i, imageUrls: Array.isArray(i.imageUrls) ? i.imageUrls : [] })) };
}

/** 관리자: C/S 상세 */
export async function getCsReport(token: string, id: string): Promise<CsReport> {
  const res = await fetch(`${API}/cs/${id}`, { headers: authHeaders(token) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'C/S를 찾을 수 없습니다.');
  }
  const i = await res.json();
  return { ...i, imageUrls: Array.isArray(i.imageUrls) ? i.imageUrls : [] };
}

/** 관리자: C/S 상태/메모 수정 */
export async function updateCsReport(
  token: string,
  id: string,
  data: { status?: string; memo?: string }
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
  return { ...i, imageUrls: Array.isArray(i.imageUrls) ? i.imageUrls : [] };
}
