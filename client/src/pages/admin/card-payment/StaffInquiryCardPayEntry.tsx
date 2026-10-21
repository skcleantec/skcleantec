import { useSyncExternalStore } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { FeatureGate } from '../../../components/auth/FeatureGate';
import { TeamCardPaymentPage } from '../../team/TeamCardPaymentPage';
import { TenantCapabilitiesProvider } from '../../../hooks/useTenantCapabilities';
import { useStandaloneTenantCapabilities } from '../../../hooks/useStandaloneTenantCapabilities';
import { getToken, subscribeAdminAuth } from '../../../stores/auth';

/** 관리자·마케터 접수 결재. 관리자 메뉴 밖에 두어 결재 화면만 연다. */
export function StaffInquiryCardPayEntry() {
  const location = useLocation();
  const token = useSyncExternalStore(subscribeAdminAuth, getToken, () => null);
  const capabilities = useStandaloneTenantCapabilities(token);

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <TenantCapabilitiesProvider value={capabilities}>
      <FeatureGate module="mod_card_payment">
        <TeamCardPaymentPage />
      </FeatureGate>
    </TenantCapabilitiesProvider>
  );
}
