import { useEffect, useState } from 'react';
import { getToken } from '../stores/auth';
import { getMe } from '../api/auth';
import { resolveEffectiveStaffAdminFromMe } from '../utils/staffAdminAccess';

/** 마케터 관리자 승격 포함 — ADMIN과 동일 업무 메뉴 여부 */
export function useEffectiveStaffAdmin(): {
  loading: boolean;
  effectiveStaffAdmin: boolean;
  marketerAdminAccess: boolean;
  role: string | null;
} {
  const token = getToken();
  const [loading, setLoading] = useState(true);
  const [effectiveStaffAdmin, setEffectiveStaffAdmin] = useState(false);
  const [marketerAdminAccess, setMarketerAdminAccess] = useState(false);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      setEffectiveStaffAdmin(false);
      setMarketerAdminAccess(false);
      setRole(null);
      return;
    }
    setLoading(true);
    void getMe(token)
      .then((u: { role?: string; marketerAdminAccess?: boolean; effectiveStaffAdminAccess?: boolean }) => {
        setRole(typeof u.role === 'string' ? u.role : null);
        setMarketerAdminAccess(Boolean(u.marketerAdminAccess));
        setEffectiveStaffAdmin(resolveEffectiveStaffAdminFromMe(u));
      })
      .catch(() => {
        setEffectiveStaffAdmin(false);
        setMarketerAdminAccess(false);
        setRole(null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  return { loading, effectiveStaffAdmin, marketerAdminAccess, role };
}
