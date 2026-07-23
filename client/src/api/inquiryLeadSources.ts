import { API } from './apiPrefix';

function headers(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export interface InquiryLeadSourceOption {
  id: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

export async function listInquiryLeadSources(
  token: string,
): Promise<{ items: InquiryLeadSourceOption[] }> {
  const res = await fetch(`${API}/inquiry-lead-sources`, { headers: headers(token) });
  if (!res.ok) throw new Error('유입경로 목록을 불러올 수 없습니다.');
  return res.json();
}

export async function listAllInquiryLeadSources(
  token: string,
): Promise<{ items: InquiryLeadSourceOption[] }> {
  const res = await fetch(`${API}/inquiry-lead-sources/all`, { headers: headers(token) });
  if (!res.ok) throw new Error('유입경로 설정을 불러올 수 없습니다.');
  return res.json();
}

export async function createInquiryLeadSource(
  token: string,
  data: { label: string; sortOrder?: number },
): Promise<InquiryLeadSourceOption> {
  const res = await fetch(`${API}/inquiry-lead-sources`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '유입경로 추가에 실패했습니다.');
  }
  return res.json();
}

export async function updateInquiryLeadSource(
  token: string,
  id: string,
  data: Partial<Pick<InquiryLeadSourceOption, 'label' | 'sortOrder' | 'isActive'>>,
): Promise<InquiryLeadSourceOption> {
  const res = await fetch(`${API}/inquiry-lead-sources/${id}`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '유입경로 수정에 실패했습니다.');
  }
  return res.json();
}

export async function deleteInquiryLeadSource(token: string, id: string): Promise<void> {
  const res = await fetch(`${API}/inquiry-lead-sources/${id}`, {
    method: 'DELETE',
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '유입경로 삭제에 실패했습니다.');
  }
}
