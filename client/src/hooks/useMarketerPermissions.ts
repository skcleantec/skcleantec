import { useCallback, useEffect, useState } from 'react';
import { getToken } from '../stores/auth';
import { getMe } from '../api/auth';
import { bootstrapAuthMeFromLocal } from '../api/authMeSnapshot';
import type { MarketerPermissionId, MarketerPermissionMap } from '@shared/marketerPermissions';
import { hasStaffPermission, type StaffAdminMeFields } from '../utils/staffAdminAccess';
import { useAdminStaffSession } from './useAdminStaffSession';

export type MarketerPermissionsState = {
  loading: boolean;
  me: StaffAdminMeFields | null;
  permissions: MarketerPermissionMap | null;
  has: (id: MarketerPermissionId) => boolean;
  refresh: () => void;
};

function staffMeFromAuthMe(raw: Record<string, unknown>): StaffAdminMeFields {
  return {
    role: typeof raw.role === 'string' ? raw.role : undefined,
    effectiveStaffAdminAccess: raw.effectiveStaffAdminAccess as boolean | undefined,
    marketerAdminLevel: raw.marketerAdminLevel as StaffAdminMeFields['marketerAdminLevel'],
    marketerPermissions: (raw.marketerPermissions as StaffAdminMeFields['marketerPermissions']) ?? null,
    marketerOperationalAdminAccess: Boolean(raw.marketerOperationalAdminAccess),
  };
}

function bootstrapStaffMe(token: string): StaffAdminMeFields | null {
  const boot = bootstrapAuthMeFromLocal(token);
  if (!boot?.role) return null;
  return staffMeFromAuthMe(boot);
}

export function useMarketerPermissions(enabled = true): MarketerPermissionsState {
  const session = useAdminStaffSession();
  const [loading, setLoading] = useState(() => {
    if (!enabled) return false;
    const token = getToken();
    if (!token) return false;
    return !bootstrapStaffMe(token);
  });
  const [me, setMe] = useState<StaffAdminMeFields | null>(() => {
    if (!enabled) return null;
    const token = getToken();
    if (!token) return null;
    return bootstrapStaffMe(token);
  });
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    if (session.ready && session.staffMe) {
      setMe(session.staffMe);
      setLoading(false);
      return;
    }
    const token = getToken();
    if (!token) {
      setLoading(false);
      setMe(null);
      return;
    }
    const boot = bootstrapStaffMe(token);
    if (boot) {
      setMe(boot);
      setLoading(false);
    } else {
      setLoading(true);
    }
    void getMe(token)
      .then((raw) => {
        setMe(staffMeFromAuthMe(raw));
      })
      .catch(() => setMe(boot))
      .finally(() => setLoading(false));
  }, [enabled, tick, session.ready, session.staffMe]);

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
