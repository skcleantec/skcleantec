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
  ownerLoginId?: string | null;
  adminLoginIds?: string[];
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
    adminLoginId: string;
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

export type PlatformTenantAdmin = {
  id: string;
  loginId: string;
  name: string;
  isActive: boolean;
  isTenantOwner: boolean;
  createdAt?: string;
};

/** @deprecated 단일 owner — admins 사용 */
export type PlatformTenantOwner = PlatformTenantAdmin;

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
  admins?: PlatformTenantAdmin[];
  /** @deprecated admins[0] */
  owner?: PlatformTenantAdmin | null;
  features: PlatformTenantFeatureRow[];
  planModules: string[];
  config?: Record<string, unknown>;
};

export function normalizePlatformTenantAdmins(detail: PlatformTenantDetail): PlatformTenantAdmin[] {
  if (detail.admins && detail.admins.length > 0) return detail.admins;
  if (detail.owner) {
    return [
      {
        ...detail.owner,
        isTenantOwner: detail.owner.isTenantOwner ?? true,
        isActive: detail.owner.isActive ?? true,
      },
    ];
  }
  return [];
}

export async function getPlatformTenant(token: string, id: string) {
  const res = await fetch(`${API}/platform/tenants/${id}`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '업체 상세 조회 실패'));
  return res.json() as Promise<PlatformTenantDetail>;
}

export async function patchPlatformTenant(
  token: string,
  id: string,
  body: { slug?: string; name?: string; plan?: string; status?: string },
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

export async function patchPlatformTenantOwner(
  token: string,
  id: string,
  body: { loginId?: string; password?: string; name?: string },
) {
  const res = await fetch(`${API}/platform/tenants/${id}/owner`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? '관리자 저장 실패');
  }
  return res.json() as Promise<{ owner: PlatformTenantAdmin; admin: PlatformTenantAdmin }>;
}

export async function createPlatformTenantAdmin(
  token: string,
  tenantId: string,
  body: { loginId: string; password: string; name?: string; isTenantOwner?: boolean },
) {
  const res = await fetch(`${API}/platform/tenants/${tenantId}/admins`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? '관리자 추가 실패');
  }
  return res.json() as Promise<{ admin: PlatformTenantAdmin }>;
}

export async function patchPlatformTenantAdmin(
  token: string,
  tenantId: string,
  adminId: string,
  body: {
    loginId?: string;
    password?: string;
    name?: string;
    isActive?: boolean;
    isTenantOwner?: boolean;
  },
) {
  const res = await fetch(`${API}/platform/tenants/${tenantId}/admins/${adminId}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? '관리자 저장 실패');
  }
  return res.json() as Promise<{ admin: PlatformTenantAdmin }>;
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

export type PlatformCrmEligibleUser = {
  id: string;
  name: string;
  loginId: string;
  role: string;
  isActive: boolean;
};

export type PlatformTelecrmPolicyResponse = {
  licensed: boolean;
  meta: {
    includedSeats: number;
    additionalSeats: number;
    allowedUserIds: string[];
    platforms: ('soomgo' | 'miso')[];
  };
};

export async function getPlatformTenantCrmEligibleUsers(token: string, tenantId: string) {
  const res = await fetch(`${API}/platform/tenants/${tenantId}/crm-eligible-users`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, 'CRM 허용 계정 조회 실패'));
  const data = (await res.json()) as { items: PlatformCrmEligibleUser[] };
  return data.items;
}

export async function getPlatformTenantTelecrmPolicy(token: string, tenantId: string) {
  const res = await fetch(`${API}/platform/tenants/${tenantId}/telecrm-policy`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, 'CRM 정책 조회 실패'));
  return res.json() as Promise<PlatformTelecrmPolicyResponse>;
}

export async function patchPlatformTenantTelecrmPolicy(
  token: string,
  tenantId: string,
  body: {
    licensed: boolean;
    includedSeats?: number;
    additionalSeats?: number;
    allowedUserIds?: string[];
    platforms?: ('soomgo' | 'miso')[];
  },
) {
  const res = await fetch(`${API}/platform/tenants/${tenantId}/telecrm-policy`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? 'CRM 정책 저장 실패');
  }
  return res.json() as Promise<PlatformTelecrmPolicyResponse>;
}
