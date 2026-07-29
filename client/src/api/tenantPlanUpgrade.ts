import { getToken } from '../stores/auth';

const API = '/api/admin/tenant-plan-upgrade';

export type TenantPlanUpgradeRequestRow = {
  id: string;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  currentPlan: string;
  requestedPlan: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  message: string | null;
  adminNote: string | null;
  requesterName: string | null;
  requesterLoginId: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export async function fetchTenantPlanUpgradeRequest(token: string) {
  const res = await fetch(API, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await res.json()) as { pending: TenantPlanUpgradeRequestRow | null; error?: string };
  if (!res.ok) throw new Error(data.error ?? '조회에 실패했습니다.');
  return data;
}

export async function createTenantPlanUpgradeRequest(
  token: string,
  body: { requestedPlan: string; message?: string },
) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { pending: TenantPlanUpgradeRequestRow; error?: string };
  if (!res.ok) throw new Error(data.error ?? '신청에 실패했습니다.');
  return data.pending;
}

export async function cancelTenantPlanUpgradeRequest(token: string, requestId: string) {
  const res = await fetch(`${API}/${encodeURIComponent(requestId)}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await res.json()) as { ok?: boolean; error?: string };
  if (!res.ok) throw new Error(data.error ?? '취소에 실패했습니다.');
  return data;
}

export function useAdminTokenOrThrow(): string {
  const token = getToken();
  if (!token) throw new Error('로그인이 필요합니다.');
  return token;
}
