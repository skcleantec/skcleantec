import { useSyncExternalStore } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { subscribeAdminAuth, getToken } from '../../stores/auth';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useSyncExternalStore(subscribeAdminAuth, getToken, () => null);
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}
