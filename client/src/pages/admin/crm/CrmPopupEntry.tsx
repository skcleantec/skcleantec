import { useEffect, useSyncExternalStore } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getToken, subscribeAdminAuth } from '../../../stores/auth';
import { CrmPage } from './CrmPage';

/**
 * 텔레CRM 전용 진입 — 팝업·세션 만료 시 로그인 후 `/admin/crm?popup=1` 복귀.
 * AdminLayout 밖에서 동작하므로 ProtectedRoute 대신 여기서 인증·복귀 경로를 고정한다.
 */
export function CrmPopupEntry() {
  const location = useLocation();
  const token = useSyncExternalStore(subscribeAdminAuth, getToken, () => null);

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

  return <CrmPage />;
}
