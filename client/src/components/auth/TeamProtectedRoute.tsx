import { useEffect, useSyncExternalStore } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { subscribeTeamAuth, getTeamToken } from '../../stores/teamAuth';
import { API } from '../../api/apiPrefix';
import { notifyAuthRejected } from '../../api/sessionGate';

const lastVerified = new Map<string, number>();
const VERIFY_MIN_INTERVAL_MS = 30 * 60 * 1000;

async function verifyTeamToken(token: string): Promise<void> {
  const now = Date.now();
  const last = lastVerified.get(token) ?? 0;
  if (now - last < VERIFY_MIN_INTERVAL_MS) return;
  lastVerified.set(token, now);
  try {
    const res = await fetch(`${API}/team/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      notifyAuthRejected('me_check', 401, 'team');
    }
  } catch {
    /* ignore */
  }
}

export function TeamProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useSyncExternalStore(subscribeTeamAuth, getTeamToken, () => null);
  const location = useLocation();

  useEffect(() => {
    if (token) void verifyTeamToken(token);
  }, [token]);

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}
