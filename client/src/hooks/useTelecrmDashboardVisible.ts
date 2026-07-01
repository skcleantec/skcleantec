import { useEffect, useState } from 'react';
import { getMe } from '../api/auth';
import { getToken } from '../stores/auth';
import { useTenantCapabilities } from './useTenantCapabilities';
import { canShowTelecrmDashboard } from '../utils/telecrmDashboardAccess';

/** /auth/me + tenant features 로 대시보드 텔레CRM 카드 노출 여부 */
export function useTelecrmDashboardVisible(): boolean {
  const { features } = useTenantCapabilities();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setVisible(false);
      return;
    }
    let cancelled = false;
    getMe(token)
      .then((u) => {
        if (cancelled) return;
        const enabledModules =
          features ?? (Array.isArray(u.features) ? u.features : null);
        setVisible(
          canShowTelecrmDashboard({
            enabledModules,
            role: typeof u.role === 'string' ? u.role : null,
            marketerPermissions: u.marketerPermissions ?? null,
          }),
        );
      })
      .catch(() => {
        if (!cancelled) setVisible(false);
      });
    return () => {
      cancelled = true;
    };
  }, [features]);

  return visible;
}
