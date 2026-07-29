import { getPlatformToken } from '../stores/platformAuth';
import type { TenantPlanUpgradeRequestRow } from './tenantPlanUpgrade';

const API = '/api/platform/plan-upgrade-requests';

export async function listPlatformPlanUpgradeRequests(
  token: string,
  status?: TenantPlanUpgradeRequestRow['status'],
) {
  const q = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await fetch(`${API}${q}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = (await res.json()) as { items: TenantPlanUpgradeRequestRow[]; error?: string };
  if (!res.ok) throw new Error(data.error ?? '조회에 실패했습니다.');
  return data.items;
}

export async function approvePlatformPlanUpgradeRequest(
  token: string,
  requestId: string,
  adminNote?: string,
) {
  const res = await fetch(`${API}/${encodeURIComponent(requestId)}/approve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminNote }),
  });
  const data = (await res.json()) as { ok?: boolean; error?: string };
  if (!res.ok) throw new Error(data.error ?? '승인에 실패했습니다.');
  return data;
}

export async function rejectPlatformPlanUpgradeRequest(
  token: string,
  requestId: string,
  adminNote?: string,
) {
  const res = await fetch(`${API}/${encodeURIComponent(requestId)}/reject`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminNote }),
  });
  const data = (await res.json()) as { ok?: boolean; error?: string };
  if (!res.ok) throw new Error(data.error ?? '반려에 실패했습니다.');
  return data;
}

export function usePlatformTokenOrThrow(): string {
  const token = getPlatformToken();
  if (!token) throw new Error('플랫폼 로그인이 필요합니다.');
  return token;
}
