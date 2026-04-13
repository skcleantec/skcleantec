const API = '/api';

function headers(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export type ExternalCompanyListItem = {
  id: string;
  name: string;
  bizNumber: string | null;
  phone: string | null;
  memo: string | null;
  partnerUserCount: number;
  partnerUsers: Array<{ id: string; email: string; name: string; phone: string | null }>;
};

export async function listExternalCompanies(token: string): Promise<{ items: ExternalCompanyListItem[] }> {
  const res = await fetch(`${API}/external-companies`, { headers: headers(token) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '목록을 불러올 수 없습니다.');
  }
  return res.json();
}

export async function createExternalCompany(
  token: string,
  data: {
    name: string;
    bizNumber?: string;
    phone?: string;
    memo?: string;
    login: { email: string; password: string; contactName: string; phone?: string };
  }
): Promise<{ company: ExternalCompanyListItem; user: { id: string; email: string; name: string } }> {
  const res = await fetch(`${API}/external-companies`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '등록에 실패했습니다.');
  }
  return res.json();
}

export async function updateExternalCompany(
  token: string,
  id: string,
  data: { name?: string; bizNumber?: string | null; phone?: string | null; memo?: string | null }
): Promise<void> {
  const res = await fetch(`${API}/external-companies/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '수정에 실패했습니다.');
  }
}

export async function deactivateExternalCompany(token: string, id: string): Promise<void> {
  const res = await fetch(`${API}/external-companies/${encodeURIComponent(id)}/deactivate`, {
    method: 'POST',
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '비활성화에 실패했습니다.');
  }
}

export type ExternalSettlementSummary = {
  from: string;
  to: string;
  rows: Array<{
    externalCompanyId: string;
    companyName: string;
    inquiryCount: number;
    feeSum: number;
  }>;
  unassigned: { inquiryCount: number; feeSum: number } | null;
  grandTotal: number;
};

export async function getExternalSettlementSummary(
  token: string,
  from: string,
  to: string
): Promise<ExternalSettlementSummary> {
  const q = new URLSearchParams({ from, to }).toString();
  const res = await fetch(`${API}/external-companies/settlement/summary?${q}`, {
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '집계를 불러올 수 없습니다.');
  }
  return res.json();
}
