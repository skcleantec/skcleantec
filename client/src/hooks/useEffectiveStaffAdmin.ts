import { useEffect, useState } from 'react';
import { getToken } from '../stores/auth';
import { getMe } from '../api/auth';
import { bootstrapAuthMeFromLocal } from '../api/authMeSnapshot';
import { resolveEffectiveStaffAdminFromMe } from '../utils/staffAdminAccess';
import { useAdminStaffSession } from './useAdminStaffSession';

/** 마케터 관리자 승격 포함 — ADMIN과 동일 업무 메뉴 여부 */
export function useEffectiveStaffAdmin(): {
  loading: boolean;
  effectiveStaffAdmin: boolean;
  marketerAdminAccess: boolean;
  role: string | null;
} {
  const session = useAdminStaffSession();
  const token = getToken();
  const bootRole =
    session.role ??
    (token ? bootstrapAuthMeFromLocal(token)?.role ?? null : null);
  const bootEffective =
    session.staffMe != null
      ? resolveEffectiveStaffAdminFromMe(session.staffMe)
      : bootRole === 'ADMIN';

  const [loading, setLoading] = useState(() => !bootRole);
  const [effectiveStaffAdmin, setEffectiveStaffAdmin] = useState(bootEffective);
  const [marketerAdminAccess, setMarketerAdminAccess] = useState(bootRole === 'ADMIN');
  const [role, setRole] = useState<string | null>(bootRole);

  useEffect(() => {
    if (session.ready && session.staffMe) {
      setRole(session.role);
      setEffectiveStaffAdmin(resolveEffectiveStaffAdminFromMe(session.staffMe));
      setMarketerAdminAccess(session.role === 'ADMIN');
      setLoading(false);
      return;
    }
    if (!token) {
      setLoading(false);
      setEffectiveStaffAdmin(false);
      setMarketerAdminAccess(false);
      setRole(null);
      return;
    }
    const boot = bootstrapAuthMeFromLocal(token);
    if (boot?.role) {
      setRole(boot.role);
      setEffectiveStaffAdmin(resolveEffectiveStaffAdminFromMe(boot));
      setMarketerAdminAccess(boot.role === 'ADMIN');
      setLoading(false);
    } else {
      setLoading(true);
    }
    void getMe(token)
      .then((u: { role?: string; marketerAdminAccess?: boolean; effectiveStaffAdminAccess?: boolean }) => {
        setRole(typeof u.role === 'string' ? u.role : null);
        setMarketerAdminAccess(Boolean(u.marketerAdminAccess));
        setEffectiveStaffAdmin(resolveEffectiveStaffAdminFromMe(u));
      })
      .catch(() => {
        if (!boot?.role) {
          setEffectiveStaffAdmin(false);
          setMarketerAdminAccess(false);
          setRole(null);
        }
      })
      .finally(() => setLoading(false));
  }, [token, session.ready, session.staffMe, session.role]);

  return { loading, effectiveStaffAdmin, marketerAdminAccess, role };
}
