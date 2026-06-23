import { API } from './apiPrefix';

function headers(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function getTenantStaffAccessSettings(
  token: string,
): Promise<{ marketerAdminAccess: boolean }> {
  const res = await fetch(`${API}/admin/tenant-staff-access`, { headers: headers(token) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '권한 설정을 불러올 수 없습니다.');
  }
  return res.json();
}

export async function updateTenantStaffAccessSettings(
  token: string,
  marketerAdminAccess: boolean,
): Promise<{ marketerAdminAccess: boolean }> {
  const res = await fetch(`${API}/admin/tenant-staff-access`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify({ marketerAdminAccess }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '권한 설정 저장에 실패했습니다.');
  }
  return res.json();
}
