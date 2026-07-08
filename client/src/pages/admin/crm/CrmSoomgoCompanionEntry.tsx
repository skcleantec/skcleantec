import { useEffect, useSyncExternalStore } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getToken, subscribeAdminAuth } from '../../../stores/auth';
import { TenantCapabilitiesProvider } from '../../../hooks/useTenantCapabilities';
import { useStandaloneTenantCapabilities } from '../../../hooks/useStandaloneTenantCapabilities';
import { CrmSoomgoCompanionPage } from './CrmSoomgoCompanionPage';

export function CrmSoomgoCompanionEntry() {
  const location = useLocation();
  const token = useSyncExternalStore(subscribeAdminAuth, getToken, () => null);
  const tenantCapabilities = useStandaloneTenantCapabilities(token);

  useEffect(() => {
    document.documentElement.dataset.telecrmPopup =
      new URLSearchParams(location.search).get('popup') === '1' ? '1' : '';
    return () => {
      delete document.documentElement.dataset.telecrmPopup;
    };
  }, [location.search]);

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <TenantCapabilitiesProvider value={tenantCapabilities}>
      <CrmSoomgoCompanionPage />
    </TenantCapabilitiesProvider>
  );
}
