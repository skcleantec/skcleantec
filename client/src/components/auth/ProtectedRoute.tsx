import { useEffect, useSyncExternalStore } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { subscribeAdminAuth, getToken } from '../../stores/auth';
import { API } from '../../api/apiPrefix';
import { notifyAuthRejected } from '../../api/sessionGate';

/**
 * 진입 시 가벼운 토큰 검증 — 만료/거부 토큰을 자동 폐기해 빈 화면 무한 루프를 막는다.
 *
 * 동시에 여러 페이지가 동시에 호출하지 않도록 마지막 검증 토큰을 모듈 메모리에 둔다.
 * 새 토큰이거나 30분이 지났을 때만 다시 검증한다.
 */
const lastVerified = new Map<string, number>();
const VERIFY_MIN_INTERVAL_MS = 30 * 60 * 1000;

async function verifyAdminToken(token: string): Promise<void> {
  const now = Date.now();
  const last = lastVerified.get(token) ?? 0;
  if (now - last < VERIFY_MIN_INTERVAL_MS) return;
  lastVerified.set(token, now);
  try {
    const res = await fetch(`${API}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401) {
      notifyAuthRejected('me_check', 401, 'admin');
    }
  } catch {
    /** 네트워크 실패 등은 무시 — 로그인 자체는 유지 */
  }
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useSyncExternalStore(subscribeAdminAuth, getToken, () => null);
  const location = useLocation();

  useEffect(() => {
    if (token) void verifyAdminToken(token);
  }, [token]);

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}
