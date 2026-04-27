import { useState, useEffect, useCallback } from 'react';
import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { getToken, clearToken } from '../../stores/auth';
import { getMe, isAuthSessionExpiredError } from '../../api/auth';
import { isLikelyNetworkFailure } from '../../api/fetchNetwork';
import { AdminSubNavScroll, adminSubNavTabClassName } from './AdminSubNavScroll';

/** 팀 관리(/admin/teams/*) — 관리자만. 권한은 레이아웃에서 한 번만 확인(탭 전환 시 자식마다 getMe 반복 방지). */
export function AdminTeamsLayout() {
  const token = getToken();
  const [roleGate, setRoleGate] = useState<'loading' | 'admin' | 'other' | 'network_error'>('loading');

  const probeAdmin = useCallback(() => {
    const t = getToken();
    if (!t) {
      setRoleGate('other');
      return;
    }
    setRoleGate('loading');
    void getMe(t)
      .then((u: { role?: string }) => setRoleGate(u.role === 'ADMIN' ? 'admin' : 'other'))
      .catch((e: unknown) => {
        if (isAuthSessionExpiredError(e)) {
          clearToken();
          return;
        }
        if (
          isLikelyNetworkFailure(e) ||
          (e instanceof Error && e.message.includes('API 서버에 연결할 수 없습니다'))
        ) {
          setRoleGate('network_error');
          return;
        }
        setRoleGate('other');
      });
  }, []);

  useEffect(() => {
    probeAdmin();
  }, [token, probeAdmin]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }
  if (roleGate === 'loading') {
    return (
      <div className="min-w-0 w-full max-w-full p-8 text-center text-gray-500 text-fluid-sm">
        권한 확인 중…
      </div>
    );
  }
  if (roleGate === 'network_error') {
    return (
      <div className="min-w-0 w-full max-w-full p-8 text-center text-fluid-sm text-gray-600">
        <p className="mb-4">일시적으로 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.</p>
        <button
          type="button"
          onClick={() => probeAdmin()}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50"
        >
          다시 시도
        </button>
      </div>
    );
  }
  if (roleGate !== 'admin') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return (
    <div className="min-w-0 w-full max-w-full">
      <AdminSubNavScroll aria-label="팀 관리 하위 메뉴">
        <NavLink to="/admin/teams/leader-stats" className={({ isActive }) => adminSubNavTabClassName(isActive)}>
          팀장
        </NavLink>
        <NavLink to="/admin/teams" end className={({ isActive }) => adminSubNavTabClassName(isActive)}>
          팀원
        </NavLink>
        <NavLink to="/admin/teams/holidays" className={({ isActive }) => adminSubNavTabClassName(isActive)}>
          휴일 캘린더
        </NavLink>
      </AdminSubNavScroll>
      <Outlet />
    </div>
  );
}
