import { API } from './apiPrefix';

function headers(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export type TenantPartnershipStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED';

export type TenantPartnershipItem = {
  id: string;
  status: TenantPartnershipStatus;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
  suspendedAt: string | null;
  suspendedBy: string | null;
  requestedByTenantId: string;
  partner: { id: string; slug: string; name: string; status: string };
  myAcceptedAt: string | null;
  partnerAcceptedAt: string | null;
  needsMyAcceptance: boolean;
  canAccept: boolean;
  canReject: boolean;
  canSuspend: boolean;
};

export async function listTenantPartnerships(token: string): Promise<{ items: TenantPartnershipItem[] }> {
  const res = await fetch(`${API}/tenant-partners`, { headers: headers(token) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '파트너 목록을 불러올 수 없습니다.');
  }
  return res.json();
}

export async function lookupTenantPartner(
  token: string,
  slug: string,
): Promise<{ partner: { slug: string; name: string; status: string } }> {
  const res = await fetch(`${API}/tenant-partners/lookup/${encodeURIComponent(slug)}`, {
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '업체를 찾을 수 없습니다.');
  }
  return res.json();
}

export async function requestTenantPartnership(
  token: string,
  data: { partnerSlug: string; memo?: string },
): Promise<{ partnership: TenantPartnershipItem }> {
  const res = await fetch(`${API}/tenant-partners/request`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '파트너 요청에 실패했습니다.');
  }
  return res.json();
}

export async function acceptTenantPartnership(
  token: string,
  id: string,
): Promise<{ partnership: TenantPartnershipItem }> {
  const res = await fetch(`${API}/tenant-partners/${encodeURIComponent(id)}/accept`, {
    method: 'POST',
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '승인에 실패했습니다.');
  }
  return res.json();
}

export async function rejectTenantPartnership(
  token: string,
  id: string,
): Promise<{ partnership: TenantPartnershipItem }> {
  const res = await fetch(`${API}/tenant-partners/${encodeURIComponent(id)}/reject`, {
    method: 'POST',
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '거절에 실패했습니다.');
  }
  return res.json();
}

export async function suspendTenantPartnership(
  token: string,
  id: string,
): Promise<{ partnership: TenantPartnershipItem }> {
  const res = await fetch(`${API}/tenant-partners/${encodeURIComponent(id)}/suspend`, {
    method: 'POST',
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '중지에 실패했습니다.');
  }
  return res.json();
}
