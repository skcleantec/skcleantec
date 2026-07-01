import { useEffect, useSyncExternalStore } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getToken, subscribeAdminAuth } from '../../../stores/auth';
import {
  TenantCapabilitiesProvider,
} from '../../../hooks/useTenantCapabilities';
import { useStandaloneTenantCapabilities } from '../../../hooks/useStandaloneTenantCapabilities';
import { CrmPage } from './CrmPage';

/**
 * 텔레CRM 전용 진입 — 팝업·세션 만료 시 로그인 후 `/admin/crm?popup=1` 복귀.
 * AdminLayout 밖에서 동작하므로 인증·테넌트 기능 목록을 여기서 제공한다.
 */
export function CrmPopupEntry() {
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
      <CrmPage />
    </TenantCapabilitiesProvider>
  );
}
