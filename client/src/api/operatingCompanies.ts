import { API } from './apiPrefix';

function headers(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

import type { OperatingCompanyBadgeColorKey } from '../../../shared/operatingCompanyConfig';
import type { TenantCompanyRegistration } from '../../../shared/tenantCompanyProfile';

export type OperatingCompanyConfig = {
  branding?: {
    displayName?: string;
    loginSubtitle?: string;
    badgeColorKey?: OperatingCompanyBadgeColorKey;
  };
  orderForm?: { publicSubtitle?: string };
  inquiry?: { numberPrefix?: string };
  companyRegistration?: Partial<TenantCompanyRegistration>;
};

export type OperatingCompanyItem = {
  id: string;
  name: string;
  slug: string;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  config: OperatingCompanyConfig;
  displayName: string;
  isPrimary?: boolean;
};

export type OperatingCompanyPolicy = {
  assignmentMode: 'strict' | 'relaxed';
  teamLeaderListMode: 'own_brands_only' | 'tenant_all_read';
  inquiryDefaultMode: 'user_primary' | 'from_intake_url' | 'creator_primary';
};

export type UserOperatingCompanySummary = {
  operatingCompanyId: string;
  name: string;
  slug: string;
  isPrimary: boolean;
  isActive: boolean;
  config?: OperatingCompanyConfig;
};

export async function listOperatingCompanies(token: string): Promise<{ items: OperatingCompanyItem[] }> {
  const res = await fetch(`${API}/operating-companies`, { headers: headers(token) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '영업 브랜드 목록을 불러올 수 없습니다.');
  }
  return res.json();
}

export async function createOperatingCompany(
  token: string,
  data: {
    name: string;
    slug: string;
    config?: OperatingCompanyConfig;
    sortOrder?: number;
  },
): Promise<OperatingCompanyItem> {
  const res = await fetch(`${API}/operating-companies`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '등록에 실패했습니다.');
  }
  return res.json();
}

export async function updateOperatingCompany(
  token: string,
  id: string,
  data: {
    name?: string;
    slug?: string;
    isActive?: boolean;
    isDefault?: boolean;
    sortOrder?: number;
    config?: OperatingCompanyConfig;
  },
): Promise<OperatingCompanyItem> {
  const res = await fetch(`${API}/operating-companies/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '수정에 실패했습니다.');
  }
  return res.json();
}

export async function getOperatingCompanyPolicy(token: string): Promise<{ policy: OperatingCompanyPolicy }> {
  const res = await fetch(`${API}/operating-companies/policy`, { headers: headers(token) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '운영 정책을 불러올 수 없습니다.');
  }
  return res.json();
}

export async function updateOperatingCompanyPolicy(
  token: string,
  policy: Partial<OperatingCompanyPolicy>,
): Promise<{ policy: OperatingCompanyPolicy }> {
  const res = await fetch(`${API}/operating-companies/policy`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify({ policy }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '운영 정책 저장에 실패했습니다.');
  }
  return res.json();
}
