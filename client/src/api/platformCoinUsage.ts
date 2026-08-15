import { API, apiErrorMessage } from './apiPrefix';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export type PlatformAiUsageUserBreakdown = {
  userId: string | null;
  name: string;
  email: string;
  role: string;
  roleLabel: string;
  count: number;
};

export type PlatformCoinUsageRow = {
  tenantId: string;
  slug: string;
  name: string;
  plan: string;
  status: string;
  unlimited: boolean;
  graceActive: boolean;
  allowance: number | null;
  spent: number;
  remaining: number | null;
  pctUsed: number | null;
  aiUsageCount: number;
  aiUsers: PlatformAiUsageUserBreakdown[];
  telecrmAiUsageCount: number;
  telecrmAiUsers: PlatformAiUsageUserBreakdown[];
};

export type PlatformCoinUsageKpi = {
  totalAllTenants: number;
  activeCount: number;
  trialCount: number;
  suspendedCount: number;
  tenantCount: number;
  totalSpent: number;
  unlimitedTenantCount: number;
  limitedTenantCount: number;
  nearLimitCount: number;
  zeroSpentCount: number;
  totalAiUsageCount: number;
  totalTelecrmAiUsageCount: number;
};

export type PlatformCoinUsageListResult = {
  periodYm: string;
  items: PlatformCoinUsageRow[];
  total: number;
  limit: number;
  offset: number;
  page: number;
  kpi: PlatformCoinUsageKpi;
};

export type ListPlatformCoinUsageParams = {
  periodYm?: string;
  q?: string;
  plan?: string;
  status?: string;
  focus?: '' | 'near_limit' | 'zero' | 'unlimited' | 'limited' | 'ai';
  sort?: 'spent_desc' | 'spent_asc' | 'name' | 'ai_desc' | 'ai_asc';
  page?: number;
  pageSize?: number;
};

export async function listPlatformCoinUsage(
  token: string,
  params: ListPlatformCoinUsageParams = {},
): Promise<PlatformCoinUsageListResult> {
  const qs = new URLSearchParams();
  if (params.periodYm) qs.set('periodYm', params.periodYm);
  if (params.q) qs.set('q', params.q);
  if (params.plan) qs.set('plan', params.plan);
  if (params.status) qs.set('status', params.status);
  if (params.focus) qs.set('focus', params.focus);
  if (params.sort) qs.set('sort', params.sort);
  if (params.page != null) qs.set('page', String(params.page));
  if (params.pageSize != null) qs.set('pageSize', String(params.pageSize));
  const res = await fetch(`${API}/platform/coin-usage?${qs}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '코인 사용량 조회 실패'));
  return res.json() as Promise<PlatformCoinUsageListResult>;
}
