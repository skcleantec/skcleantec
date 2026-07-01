import { useCallback, useEffect, useState } from 'react';
import { getToken } from '../stores/auth';
import { getMe } from '../api/auth';
import type { MarketerPermissionId, MarketerPermissionMap } from '@shared/marketerPermissions';
import { hasStaffPermission, type StaffAdminMeFields } from '../utils/staffAdminAccess';

export type MarketerPermissionsState = {
  loading: boolean;
  me: StaffAdminMeFields | null;
  permissions: MarketerPermissionMap | null;
  has: (id: MarketerPermissionId) => boolean;
  refresh: () => void;
};

export function useMarketerPermissions(enabled = true): MarketerPermissionsState {
  const [loading, setLoading] = useState(enabled);
  const [me, setMe] = useState<StaffAdminMeFields | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    const token = getToken();
    if (!token) {
      setLoading(false);
      setMe(null);
      return;
    }
    setLoading(true);
    void getMe(token)
      .then((raw) => {
        const next: StaffAdminMeFields = {
          role: raw.role,
          effectiveStaffAdminAccess: raw.effectiveStaffAdminAccess,
          marketerAdminLevel: raw.marketerAdminLevel,
          marketerPermissions: raw.marketerPermissions ?? null,
          marketerOperationalAdminAccess: raw.marketerOperationalAdminAccess,
        };
        setMe(next);
      })
      .catch(() => setMe(null))
      .finally(() => setLoading(false));
  }, [enabled, tick]);

  const has = useCallback(
    (id: MarketerPermissionId) => hasStaffPermission(me, id),
    [me],
  );

  return {
    loading,
    me,
    permissions: me?.marketerPermissions ?? null,
    has,
    refresh,
  };
}
