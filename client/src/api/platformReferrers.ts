import { getPlatformToken } from '../stores/platformAuth';
import type {
  PlatformReferrerCommissionStatus,
  PlatformReferrerStatus,
  PlatformReferrerType,
} from '@shared/platformReferral';

export type PlatformReferrerListItem = {
  id: string;
  type: PlatformReferrerType;
  code: string;
  displayName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  partnerTenantId: string | null;
  partnerTenant: { id: string; slug: string; name: string } | null;
  commissionRateBps: number;
  commissionRateLabel: string;
  eligiblePlanIds: string[] | null;
  status: PlatformReferrerStatus;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
  signupCount: number;
  paidTenantCount: number;
  pendingCommissionKrw: number;
  paidCommissionKrw: number;
};

export type PlatformReferrerDetail = PlatformReferrerListItem & {
  signupLink: string;
};

export type PlatformReferrerSignupRow = {
  id: string;
  signupMethod: string;
  refCodeUsed: string;
  attributedAt: string;
  tenant: {
    id: string;
    slug: string;
    name: string;
    plan: string;
    status: string;
    createdAt: string;
  };
  paidInvoiceCount: number;
  totalCommissionKrw: number;
};

export type PlatformReferrerCommissionRow = {
  id: string;
  tenant: { id: string; slug: string; name: string };
  invoice: {
    id: string;
    plan: string;
    amountKrw: number;
    periodStart: string;
    paidAt: string | null;
  };
  periodYm: string;
  invoicePaidAmount: number;
  commissionRateBps: number;
  commissionAmount: number;
  status: PlatformReferrerCommissionStatus;
  paidAt: string | null;
  paidMemo: string | null;
  createdAt: string;
};

const API = '/api/platform/referrers';

function headers(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export function usePlatformTokenOrThrow() {
  const token = getPlatformToken();
  if (!token) throw new Error('플랫폼 로그인이 필요합니다.');
  return token;
}

export async function listPlatformReferrers(token: string, params?: { status?: PlatformReferrerStatus; q?: string }) {
  const q = new URLSearchParams();
  if (params?.status) q.set('status', params.status);
  if (params?.q?.trim()) q.set('q', params.q.trim());
  const res = await fetch(`${API}?${q}`, { headers: { Authorization: `Bearer ${token}` } });
  const data = (await res.json()) as { items: PlatformReferrerListItem[]; error?: string };
  if (!res.ok) throw new Error(data.error ?? '조회에 실패했습니다.');
  return data;
}

export async function fetchPlatformReferrer(token: string, id: string) {
  const res = await fetch(`${API}/${id}`, { headers: { Authorization: `Bearer ${token}` } });
  const data = (await res.json()) as { item: PlatformReferrerDetail; error?: string };
  if (!res.ok) throw new Error(data.error ?? '조회에 실패했습니다.');
  return data.item;
}

export async function createPlatformReferrer(
  token: string,
  body: {
    type: PlatformReferrerType;
    code: string;
    displayName: string;
    contactEmail?: string | null;
    contactPhone?: string | null;
    partnerTenantId?: string | null;
    commissionRateBps?: number;
    memo?: string | null;
  },
) {
  const res = await fetch(API, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { item: PlatformReferrerDetail; error?: string };
  if (!res.ok) throw new Error(data.error ?? '등록에 실패했습니다.');
  return data.item;
}

export async function updatePlatformReferrer(
  token: string,
  id: string,
  body: Partial<{
    displayName: string;
    contactEmail: string | null;
    contactPhone: string | null;
    partnerTenantId: string | null;
    commissionRateBps: number;
    status: PlatformReferrerStatus;
    memo: string | null;
  }>,
) {
  const res = await fetch(`${API}/${id}`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { item: PlatformReferrerDetail; error?: string };
  if (!res.ok) throw new Error(data.error ?? '저장에 실패했습니다.');
  return data.item;
}

export async function listPlatformReferrerSignups(token: string, id: string, limit = 50, offset = 0) {
  const q = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  const res = await fetch(`${API}/${id}/signups?${q}`, { headers: { Authorization: `Bearer ${token}` } });
  const data = (await res.json()) as { items: PlatformReferrerSignupRow[]; total: number; error?: string };
  if (!res.ok) throw new Error(data.error ?? '조회에 실패했습니다.');
  return data;
}

export async function listPlatformReferrerCommissions(
  token: string,
  id: string,
  params?: { status?: PlatformReferrerCommissionStatus; limit?: number; offset?: number },
) {
  const q = new URLSearchParams();
  if (params?.status) q.set('status', params.status);
  if (params?.limit) q.set('limit', String(params.limit));
  if (params?.offset) q.set('offset', String(params.offset));
  const res = await fetch(`${API}/${id}/commissions?${q}`, { headers: { Authorization: `Bearer ${token}` } });
  const data = (await res.json()) as {
    items: PlatformReferrerCommissionRow[];
    total: number;
    error?: string;
  };
  if (!res.ok) throw new Error(data.error ?? '조회에 실패했습니다.');
  return data;
}

export async function updatePlatformReferrerCommissionStatus(
  token: string,
  id: string,
  body: { accrualIds: string[]; status: PlatformReferrerCommissionStatus; paidMemo?: string | null },
) {
  const res = await fetch(`${API}/${id}/commissions/status`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as { updated: number; error?: string };
  if (!res.ok) throw new Error(data.error ?? '처리에 실패했습니다.');
  return data;
}
