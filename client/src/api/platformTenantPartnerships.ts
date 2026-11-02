import { API, apiErrorMessage } from './apiPrefix';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export type PlatformTenantPartnershipItem = {
  id: string;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED';
  suspendedAt: string | null;
  suspendedBy: 'TENANT_LOW' | 'TENANT_HIGH' | 'PLATFORM' | null;
  createdAt: string;
  updatedAt: string;
  tenantLow: { id: string; slug: string; name: string; status: string };
  tenantHigh: { id: string; slug: string; name: string; status: string };
  shareCount: number;
  activeShareCount: number;
  pausedShareCount: number;
};

export async function listPlatformTenantPartnerships(token: string): Promise<PlatformTenantPartnershipItem[]> {
  const res = await fetch(`${API}/platform/tenant-partnerships`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '파트너 연결 목록을 불러오지 못했습니다.'));
  const data = (await res.json()) as { items: PlatformTenantPartnershipItem[] };
  return data.items ?? [];
}

export async function platformSuspendTenantPartnership(token: string, id: string): Promise<void> {
  const res = await fetch(`${API}/platform/tenant-partnerships/${encodeURIComponent(id)}/suspend`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '파트너 연결 중지에 실패했습니다.'));
}

export async function platformResumeTenantPartnership(token: string, id: string): Promise<void> {
  const res = await fetch(`${API}/platform/tenant-partnerships/${encodeURIComponent(id)}/resume`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '파트너 연결 재개에 실패했습니다.'));
}
