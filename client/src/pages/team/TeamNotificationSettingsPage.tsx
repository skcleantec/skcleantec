import { useCallback } from 'react';
import { getTeamToken } from '../../stores/teamAuth';
import {
  getTeamNotificationPreferences,
  updateTeamNotificationPreferences,
} from '../../api/notificationPolicy';
import { StaffNotificationSettingsPanel } from '../../components/notifications/StaffNotificationSettingsPanel';
import type { StaffAppPushKind } from '@shared/staffAppPush';

export function TeamNotificationSettingsPage() {
  const token = getTeamToken();

  const loadItems = useCallback(async () => {
    if (!token) return [];
    const r = await getTeamNotificationPreferences(token);
    return r.items;
  }, [token]);

  const saveToggle = useCallback(
    async (kind: StaffAppPushKind, push: boolean) => {
      if (!token) return [];
      const r = await updateTeamNotificationPreferences(token, { [kind]: { push } });
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
      backHref="/team/dashboard"
      backLabel="← 대시보드"
    />
  );
}
