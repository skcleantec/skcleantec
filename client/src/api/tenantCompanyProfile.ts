import { postBlobToStorage } from '../utils/browserStorageUpload';
import type {
  TenantCompanyRegistration,
  TenantCompanyProfileDto,
  TenantCompanyProfilePatch,
  OperatingCompanySmtpSetting,
  TenantSmtpSettingsPublic,
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

export async function uploadTenantCompanySeal(
  blob: Blob,
  token: string,
  filename: string,
): Promise<{ publicId: string; secureUrl: string }> {
  return postBlobToStorage({
    url: `${API}/admin/tenant-company-profile/seal-upload`,
    blob,
    filename,
    headers: { Authorization: `Bearer ${token}` },
    folderPrefix: 'company-seal',
  });
}

export async function sendTenantCompanyProfileTestEmail(
  token: string,
  to: string,
  operatingCompanyId?: string | null,
): Promise<void> {
  const res = await fetch(`${API}/admin/tenant-company-profile/test-email`, {
    method: 'POST',
    headers: adminHeaders(token),
    body: JSON.stringify({
      to,
      ...(operatingCompanyId ? { operatingCompanyId } : {}),
    }),
  });
  const data = (await res.json()) as { ok?: boolean; error?: string };
  if (!res.ok) throw new Error(data.error ?? '테스트 메일 발송에 실패했습니다.');
}

/** 저장된 SMTP 앱 비밀번호 조회(본인 로그인 비밀번호 확인) */
export async function revealTenantCompanySmtpPassword(
  token: string,
  password: string,
  operatingCompanyId?: string | null,
): Promise<{ password: string }> {
  const res = await fetch(`${API}/admin/tenant-company-profile/reveal-smtp-password`, {
    method: 'POST',
    headers: adminHeaders(token),
    body: JSON.stringify({
      password,
      ...(operatingCompanyId ? { operatingCompanyId } : {}),
    }),
  });
  const data = (await res.json()) as { password?: string; error?: string };
  if (!res.ok) throw new Error(data.error ?? '앱 비밀번호를 불러오지 못했습니다.');
  if (!data.password?.trim()) throw new Error('앱 비밀번호를 불러오지 못했습니다.');
  return { password: data.password };
}

/** 업체 공통 또는 브랜드 SMTP 설정 삭제(본인 로그인 비밀번호 확인) */
export async function clearTenantCompanySmtp(
  token: string,
  password: string,
  operatingCompanyId?: string | null,
): Promise<TenantCompanyProfileDto> {
  const res = await fetch(`${API}/admin/tenant-company-profile/clear-smtp`, {
    method: 'POST',
    headers: adminHeaders(token),
    body: JSON.stringify({
      password,
      ...(operatingCompanyId ? { operatingCompanyId } : {}),
    }),
  });
  const data = (await res.json()) as TenantCompanyProfileDto & { error?: string };
  if (!res.ok) throw new Error(data.error ?? 'SMTP 설정을 삭제하지 못했습니다.');
  return data;
}

export type {
  TenantCompanyRegistration,
  TenantCompanyProfileDto,
  TenantCompanyProfilePatch,
  OperatingCompanySmtpSetting,
  TenantSmtpSettingsPublic,
};
