import { useCallback } from 'react';
import { getToken } from '../../stores/auth';
import {
  getAdminNotificationPreferences,
  updateAdminNotificationPreferences,
} from '../../api/notificationPolicy';
import { StaffNotificationSettingsPanel } from '../../components/notifications/StaffNotificationSettingsPanel';
import type { StaffAppPushKind } from '@shared/staffAppPush';

export function AdminNotificationSettingsPage() {
  const token = getToken();

  const loadItems = useCallback(async () => {
    if (!token) return [];
    const r = await getAdminNotificationPreferences(token);
    return r.items;
  }, [token]);

  const saveToggle = useCallback(
    async (kind: StaffAppPushKind, push: boolean) => {
      if (!token) return [];
      const r = await updateAdminNotificationPreferences(token, { [kind]: { push } });
      return r.items;
    },
    [token],
  );

  if (!token) {
    return (
      <div className="py-8 text-center text-fluid-xs text-slate-500">로그인이 필요합니다.</div>
    );
  }

  return (
    <StaffNotificationSettingsPanel
      authToken={token}
      loadItems={loadItems}
      saveToggle={saveToggle}
      backHref="/admin/dashboard"
      backLabel="← 대시보드"
    />
  );
}
