import { useSyncExternalStore } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { canAccessAdminPath } from '@shared/marketerPermissionNav';
import { FeatureGate } from '../../../components/auth/FeatureGate';
import { TelecrmAccessModal } from '../../../components/admin/TelecrmAccessModal';
import { useMarketerPermissions } from '../../../hooks/useMarketerPermissions';
import {
  TenantCapabilitiesProvider,
  useTenantCapabilities,
} from '../../../hooks/useTenantCapabilities';
import { useStandaloneTenantCapabilities } from '../../../hooks/useStandaloneTenantCapabilities';
import { getToken, subscribeAdminAuth } from '../../../stores/auth';
import { canAccessTelecrm } from '../../../utils/telecrmDashboardAccess';
import { CrmQuickScheduleWindowPage } from './CrmQuickScheduleWindowPage';

function QuickScheduleWindowGate() {
  const permissions = useMarketerPermissions();
  const { features, telecrm } = useTenantCapabilities();
  const canView =
    permissions.me?.role === 'ADMIN' ||
    canAccessAdminPath(permissions.me?.role, permissions.permissions, '/admin/crm');

  if (permissions.loading || features === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-8 text-center">
        <p className="text-[13px] text-slate-500">권한 확인 중…</p>
      </div>
    );
  }
  if (!canView) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-8 text-center">
        <p className="text-[13px] text-amber-900">텔레CRM 사용 권한이 없습니다.</p>
      </div>
    );
  }
  if (!telecrm || !canAccessTelecrm(telecrm)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-8">
        <TelecrmAccessModal open reason={telecrm?.denyReason ?? 'not_licensed'} onClose={() => window.close()} />
      </div>
    );
  }
  return <CrmQuickScheduleWindowPage />;
}

export function CrmQuickScheduleWindowEntry() {
  const location = useLocation();
  const token = useSyncExternalStore(subscribeAdminAuth, getToken, () => null);
  const tenantCapabilities = useStandaloneTenantCapabilities(token);

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <TenantCapabilitiesProvider value={tenantCapabilities}>
      <FeatureGate module="mod_telecrm">
        <QuickScheduleWindowGate />
      </FeatureGate>
    </TenantCapabilitiesProvider>
  );
}
