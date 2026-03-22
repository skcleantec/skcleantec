const API = '/api';

function headers(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function getInquiries(token: string, params?: { status?: string; search?: string }) {
  const q = new URLSearchParams(params as Record<string, string>).toString();
  const res = await fetch(`${API}/inquiries?${q}`, {
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
