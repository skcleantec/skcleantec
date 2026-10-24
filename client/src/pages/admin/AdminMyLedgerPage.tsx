import { useCallback } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { isSoloOperatorTenant } from '@shared/soloOperator';
import { TeamHouseholdLedgerPage } from '../team/TeamHouseholdLedgerPage';
import { clearToken, getToken } from '../../stores/auth';
import { useTenantCapabilities } from '../../hooks/useTenantCapabilities';
import { useAdminStaffSession } from '../../hooks/useAdminStaffSession';

/** 1인 업체 관리자 본인 가계부. 팀장 화면을 그대로 쓴다. */
export function AdminMyLedgerPage() {
  const token = getToken();
  const navigate = useNavigate();
  const location = useLocation();
  const onSessionExpired = useCallback(() => {
    clearToken();
    navigate('/login', { replace: true, state: { from: location } });
  }, [navigate, location]);
  const { features } = useTenantCapabilities();
  const { role, ready } = useAdminStaffSession();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (ready && features && (role !== 'ADMIN' || !isSoloOperatorTenant(features))) {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return (
    <TeamHouseholdLedgerPage
      authToken={token}
      hideTitle
      syncButtonLabel="내 접수 불러오기"
      onSessionExpired={onSessionExpired}
    />
  );
}
