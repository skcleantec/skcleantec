import { useMemo } from 'react';
import { useAdminStaffSession } from './useAdminStaffSession';
import { canShowTelecrmDashboard } from '../utils/telecrmDashboardAccess';

/** tenant features + 세션 role/권한으로 대시보드 텔레CRM 카드 노출 여부 (라이선스와 무관) */
export function useTelecrmDashboardVisible(): boolean {
  const { ready, staffMe } = useAdminStaffSession();

  return useMemo(() => {
    if (!ready || !staffMe) return false;
    return canShowTelecrmDashboard({
      role: staffMe.role ?? null,
      marketerPermissions: staffMe.marketerPermissions ?? null,
    });
  }, [ready, staffMe]);
}
