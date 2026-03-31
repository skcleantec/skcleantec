import { useSyncExternalStore } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { subscribeTeamAuth, getTeamToken } from '../../stores/teamAuth';

export function TeamProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useSyncExternalStore(subscribeTeamAuth, getTeamToken, () => null);
  const location = useLocation();

  if (!token) {
    return <Navigate to="/team/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}
