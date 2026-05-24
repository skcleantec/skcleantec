import { API, apiErrorMessage } from './apiPrefix';

export async function platformLogin(email: string, password: string) {
  const res = await fetch(`${API}/platform/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `로그인 실패 (HTTP ${res.status})`);
  }
  return res.json() as Promise<{
    token: string;
    user: { id: string; email: string; name: string; role: string };
  }>;
}

export async function getPlatformMe(token: string) {
  const res = await fetch(`${API}/platform/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    throw new Error('SESSION_EXPIRED');
  }
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, '플랫폼 세션 확인 실패'));
  }
  return res.json() as Promise<{ id: string; email: string; name: string; role: string }>;
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export type PlatformTenantRow = {
  id: string;
  slug: string;
  name: string;
  plan: string;
  status: string;
  createdAt: string;
  userCount: number;
  inquiryCount: number;
};

export async function listPlatformTenants(token: string) {
  const res = await fetch(`${API}/platform/tenants`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '업체 목록 조회 실패'));
  const data = (await res.json()) as { items: PlatformTenantRow[] };
  return data.items;
}

export async function createPlatformTenant(
  token: string,
  body: {
    slug: string;
    name: string;
    plan: string;
    adminEmail: string;
    adminPassword: string;
    adminName?: string;
  },
) {
  const res = await fetch(`${API}/platform/tenants`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `업체 생성 실패 (HTTP ${res.status})`);
  }
  return res.json();
}

export type PlatformTenantFeatureRow = {
  moduleId: string;
  label: string;
  tier: string;
  locked: boolean;
  inPlan: boolean;
  enabled: boolean;
  effective: boolean;
};

export type PlatformTenantDetail = {
  tenant: {
    id: string;
    slug: string;
    name: string;
    plan: string;
    status: string;
    createdAt: string;
    timezone?: string;
  };
  features: PlatformTenantFeatureRow[];
  planModules: string[];
  config?: Record<string, unknown>;
};

export async function getPlatformTenant(token: string, id: string) {
  const res = await fetch(`${API}/platform/tenants/${id}`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '업체 상세 조회 실패'));
  return res.json() as Promise<PlatformTenantDetail>;
}

export async function patchPlatformTenant(
  token: string,
  id: string,
  body: { name?: string; plan?: string; status?: string },
) {
  const res = await fetch(`${API}/platform/tenants/${id}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? '저장 실패');
  }
  return res.json();
}

export async function savePlatformTenantFeatures(
  token: string,
  id: string,
  features: { moduleId: string; enabled: boolean }[],
) {
  const res = await fetch(`${API}/platform/tenants/${id}/features`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify({ features }),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '기능 저장 실패'));
  return res.json() as Promise<PlatformTenantDetail>;
}

export async function resetPlatformTenantFeaturesFromPlan(token: string, id: string) {
  const res = await fetch(`${API}/platform/tenants/${id}/features/reset-from-plan`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '플랜 재적용 실패'));
  return res.json() as Promise<PlatformTenantDetail>;
}

export async function patchPlatformTenantConfig(token: string, id: string, config: unknown) {
  const res = await fetch(`${API}/platform/tenants/${id}/config`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? '설정 저장 실패');
  }
  return res.json() as Promise<{ config: Record<string, unknown> }>;
}
