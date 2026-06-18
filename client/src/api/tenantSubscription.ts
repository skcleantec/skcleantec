const API = '/api';

export type TenantSubscriptionUsageRow = {
  id: string;
  label: string;
  used: number;
  limit: number | null;
  unit: string;
};

export type TenantSubscriptionServiceRow = {
  moduleId: string;
  label: string;
  tier: string;
};

export type TenantSubscriptionDto = {
  tenant: {
    id: string;
    slug: string;
    name: string;
    status: string;
    plan: string;
    planLabel: string;
    timezone: string;
    createdAt: string;
    suspendedAt: string | null;
  };
  usageSnapshotAt: string;
  serviceUpdatedAt: string;
  enabledServices: TenantSubscriptionServiceRow[];
  usage: TenantSubscriptionUsageRow[];
  billingNote: string;
};

export async function fetchTenantSubscription(token: string): Promise<TenantSubscriptionDto> {
  const res = await fetch(`${API}/admin/tenant-subscription`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  let data: TenantSubscriptionDto & { error?: string };
  try {
    data = (await res.json()) as TenantSubscriptionDto & { error?: string };
  } catch {
    throw new Error('가입 정보를 불러오지 못했습니다.');
  }
  if (!res.ok) throw new Error(data.error ?? '가입 정보를 불러오지 못했습니다.');
  if (!data?.tenant || !Array.isArray(data.usage)) {
    throw new Error('가입 정보 응답 형식이 올바르지 않습니다.');
  }
  return data;
}
