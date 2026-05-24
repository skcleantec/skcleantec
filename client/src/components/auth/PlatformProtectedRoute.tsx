import { useSyncExternalStore, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getPlatformToken, subscribePlatformAuth, clearPlatformToken } from '../../stores/platformAuth';
import { API } from '../../api/apiPrefix';

export function PlatformProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useSyncExternalStore(subscribePlatformAuth, getPlatformToken, () => null);
  const location = useLocation();

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/platform/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (res.status === 401) clearPlatformToken();
      })
      .catch(() => {});
  }, [token]);

  if (!token) {
    return <Navigate to="/platform/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}
