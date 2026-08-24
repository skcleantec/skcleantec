import { API } from './apiPrefix';
import type {
  NotificationKindRule,
  TenantNotificationPolicyDto,
} from '@shared/notificationPolicy';
import type { StaffAppPushKind } from '@shared/staffAppPush';

export type { NotificationKindRule, TenantNotificationPolicyDto };

function headers(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

async function parseJson<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(typeof (data as { error?: string }).error === 'string' ? (data as { error: string }).error : '요청 실패');
  }
  return data;
}

export async function getAdminNotificationPolicy(token: string): Promise<{ policy: TenantNotificationPolicyDto }> {
  const res = await fetch(`${API}/admin/notification-policy`, { headers: headers(token) });
  return parseJson(res);
}

export async function updateAdminNotificationPolicy(
  token: string,
  policy: TenantNotificationPolicyDto,
): Promise<{ policy: TenantNotificationPolicyDto }> {
  const res = await fetch(`${API}/admin/notification-policy`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify({ policy }),
  });
  return parseJson(res);
}

export type TeamNotificationSettingItem = {
  kind: StaffAppPushKind;
  label: string;
  description: string;
  mandatory: boolean;
  push: boolean;
  canToggle: boolean;
};

export type AdminNotificationSettingItem = TeamNotificationSettingItem;

export async function getTeamNotificationPreferences(
  token: string,
): Promise<{ items: TeamNotificationSettingItem[] }> {
  const res = await fetch(`${API}/team/notification-preferences`, { headers: headers(token) });
  return parseJson(res);
}

export async function updateTeamNotificationPreferences(
  token: string,
  kinds: Partial<Record<StaffAppPushKind, { push: boolean }>>,
): Promise<{ items: TeamNotificationSettingItem[] }> {
  const res = await fetch(`${API}/team/notification-preferences`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify({ kinds }),
  });
  return parseJson(res);
}

export async function getAdminNotificationPreferences(
  token: string,
): Promise<{ items: AdminNotificationSettingItem[] }> {
  const res = await fetch(`${API}/admin/notification-preferences`, { headers: headers(token) });
  return parseJson(res);
}

export async function updateAdminNotificationPreferences(
  token: string,
  kinds: Partial<Record<StaffAppPushKind, { push: boolean }>>,
): Promise<{ items: AdminNotificationSettingItem[] }> {
  const res = await fetch(`${API}/admin/notification-preferences`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify({ kinds }),
  });
  return parseJson(res);
}
