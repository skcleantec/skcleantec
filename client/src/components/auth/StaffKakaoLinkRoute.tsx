import { useSyncExternalStore } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { subscribeAdminAuth, getToken } from '../../stores/auth';
import { subscribeTeamAuth, getTeamToken } from '../../stores/teamAuth';

/** 관리자·마케터(admin JWT) 또는 팀장·타업체(team JWT) — 카카오 연결 전용 */
export function StaffKakaoLinkRoute({ children }: { children: React.ReactNode }) {
  const adminToken = useSyncExternalStore(subscribeAdminAuth, getToken, () => null);
  const teamToken = useSyncExternalStore(subscribeTeamAuth, getTeamToken, () => null);
  const location = useLocation();

  if (!adminToken && !teamToken) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
