import type { MarketerAdminLevel } from '@shared/marketerAdminLevel';
import type { MarketerPermissionGroup, MarketerPermissionId, MarketerPermissionMap } from '@shared/marketerPermissions';
import { API, apiErrorMessage } from './apiPrefix';

function headers(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export type MarketerPermissionsUserResponse = {
  userId: string;
  name: string;
  email: string;
  isActive: boolean;
  marketerAdminLevel: MarketerAdminLevel;
  hasCustomPermissions: boolean;
  isModifiedFromPreset: boolean;
  permissions: MarketerPermissionMap;
};

export async function getMarketerPermissionsCatalog(token: string): Promise<{ groups: MarketerPermissionGroup[] }> {
  const res = await fetch(`${API}/admin/marketer-permissions/catalog`, { headers: headers(token) });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '권한 목록을 불러올 수 없습니다.'));
  return res.json();
}

export async function listMarketerPermissionsUsers(
  token: string,
): Promise<{ items: MarketerPermissionsUserResponse[] }> {
  const res = await fetch(`${API}/admin/marketer-permissions/users`, { headers: headers(token) });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '마케터 목록을 불러올 수 없습니다.'));
  return res.json();
}

export async function getMarketerPermissionsUser(
  token: string,
  userId: string,
): Promise<MarketerPermissionsUserResponse> {
  const res = await fetch(`${API}/admin/marketer-permissions/users/${encodeURIComponent(userId)}`, {
    headers: headers(token),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '마케터 권한을 불러올 수 없습니다.'));
  return res.json();
}

export async function saveMarketerPermissionsUser(
  token: string,
  userId: string,
  body: { marketerAdminLevel: MarketerAdminLevel; permissions: MarketerPermissionMap },
): Promise<MarketerPermissionsUserResponse> {
  const res = await fetch(`${API}/admin/marketer-permissions/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '권한을 저장하지 못했습니다.'));
  return res.json();
}

export type { MarketerPermissionId };
