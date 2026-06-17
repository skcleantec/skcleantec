import type {
  TenantCompanyRegistration,
  TenantCompanyProfileDto,
  TenantCompanyProfilePatch,
} from '@shared/tenantCompanyProfile';

const API = import.meta.env.VITE_API_URL ?? '/api';

function adminHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export async function fetchTenantCompanyProfile(token: string): Promise<TenantCompanyProfileDto> {
  const res = await fetch(`${API}/admin/tenant-company-profile`, {
    headers: adminHeaders(token),
  });
  const data = (await res.json()) as TenantCompanyProfileDto & { error?: string };
  if (!res.ok) throw new Error(data.error ?? '업체등록정보를 불러오지 못했습니다.');
  return data;
}

export async function patchTenantCompanyProfile(
  token: string,
  patch: TenantCompanyProfilePatch,
): Promise<TenantCompanyProfileDto> {
  const res = await fetch(`${API}/admin/tenant-company-profile`, {
    method: 'PATCH',
    headers: adminHeaders(token),
    body: JSON.stringify(patch),
  });
  const data = (await res.json()) as TenantCompanyProfileDto & { error?: string };
  if (!res.ok) throw new Error(data.error ?? '저장하지 못했습니다.');
  return data;
}

export async function sendTenantCompanyProfileTestEmail(
  token: string,
  to: string,
): Promise<void> {
  const res = await fetch(`${API}/admin/tenant-company-profile/test-email`, {
    method: 'POST',
    headers: adminHeaders(token),
    body: JSON.stringify({ to }),
  });
  const data = (await res.json()) as { ok?: boolean; error?: string };
  if (!res.ok) throw new Error(data.error ?? '테스트 메일 발송에 실패했습니다.');
}

export type {
  TenantCompanyRegistration,
  TenantCompanyProfileDto,
  TenantCompanyProfilePatch,
};
