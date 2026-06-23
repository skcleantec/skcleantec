import { API, apiErrorMessage } from './apiPrefix';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export type PlatformDbMarketplaceListItem = {
  id: string;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  status: string;
  listingFee: number;
  displayAmount: number | null;
  publishedAt: string | null;
  expiresAt: string | null;
  platformSuspendedAt: string | null;
  buyerKind: string | null;
  buyerTenantName: string | null;
  confirmedAt: string | null;
};

export async function listPlatformDbMarketplace(
  token: string,
  opts?: { tenantId?: string },
): Promise<PlatformDbMarketplaceListItem[]> {
  const qs = new URLSearchParams();
  if (opts?.tenantId) qs.set('tenantId', opts.tenantId);
  const q = qs.toString();
  const res = await fetch(`${API}/platform/db-marketplace${q ? `?${q}` : ''}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '정보공유 목록 조회 실패'));
  const data = (await res.json()) as { items: PlatformDbMarketplaceListItem[] };
  return data.items ?? [];
}

export async function platformSuspendDbListing(token: string, listingId: string): Promise<void> {
  const res = await fetch(`${API}/platform/db-marketplace/${encodeURIComponent(listingId)}/suspend`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '중지 실패'));
}

export async function platformResumeDbListing(token: string, listingId: string): Promise<void> {
  const res = await fetch(`${API}/platform/db-marketplace/${encodeURIComponent(listingId)}/resume`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '중지 해제 실패'));
}
