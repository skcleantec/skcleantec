import { useMemo } from 'react';
import { useTenantCapabilities } from './useTenantCapabilities';
import { useAdminStaffSession } from './useAdminStaffSession';
import { canShowTelecrmDashboard } from '../utils/telecrmDashboardAccess';

/** tenant features + 세션 role/권한으로 대시보드 텔레CRM 카드 노출 여부 */
export function useTelecrmDashboardVisible(): boolean {
  const { features } = useTenantCapabilities();
  const { ready, staffMe } = useAdminStaffSession();

  return useMemo(() => {
    if (!ready || !staffMe) return false;
    return canShowTelecrmDashboard({
      enabledModules: features,
      role: staffMe.role ?? null,
      marketerPermissions: staffMe.marketerPermissions ?? null,
    });
  }, [ready, staffMe, features]);
}
