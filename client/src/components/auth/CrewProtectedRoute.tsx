import { useSyncExternalStore } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { subscribeCrewAuth, getCrewToken } from '../../stores/crewAuth';

export function CrewProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useSyncExternalStore(subscribeCrewAuth, getCrewToken, () => null);
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}
