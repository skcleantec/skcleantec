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
  const signRes = await fetch(`${API}/admin/tenant-company-profile/seal-upload-sign`, {
    method: 'POST',
    headers: adminHeaders(token),
    body: JSON.stringify({}),
  });
  const signJson = await signRes.json().catch(() => ({}));
  if (!signRes.ok) {
    throw new Error((signJson as { error?: string }).error || '업로드 준비에 실패했습니다.');
  }
  const m = signJson as {
    cloudName: string;
    apiKey: string;
    timestamp: number;
    signature: string;
    folder: string;
  };

  const fd = new FormData();
  fd.append('file', blob, filename);
  fd.append('api_key', m.apiKey);
  fd.append('timestamp', String(m.timestamp));
  fd.append('signature', m.signature);
  fd.append('folder', m.folder);

  const upl = await fetch(`https://api.cloudinary.com/v1_1/${m.cloudName}/image/upload`, {
    method: 'POST',
    body: fd,
  });
  const uj = await upl.json().catch(() => ({}));
  if (!upl.ok) {
    throw new Error((uj as { error?: { message?: string } }).error?.message || '파일 업로드에 실패했습니다.');
  }
  const publicId =
    typeof (uj as { public_id?: string }).public_id === 'string' ? (uj as { public_id: string }).public_id : '';
  const secureUrl =
    typeof (uj as { secure_url?: string }).secure_url === 'string' ? (uj as { secure_url: string }).secure_url : '';
  if (!publicId.startsWith(`${m.folder}/`) || !secureUrl) {
    throw new Error('업로드 결과가 규격에 맞지 않습니다.');
  }
  return { publicId, secureUrl };
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

export type {
  TenantCompanyRegistration,
  TenantCompanyProfileDto,
  TenantCompanyProfilePatch,
  OperatingCompanySmtpSetting,
  TenantSmtpSettingsPublic,
};
