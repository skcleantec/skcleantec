import { useState, useEffect, useCallback } from 'react';
import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom';
import { getToken } from '../../stores/auth';
import { getMe, isAuthSessionExpiredError } from '../../api/auth';
import { isLikelyNetworkFailure } from '../../api/fetchNetwork';
import { AdminSubNavScroll, adminSubNavTabClassName } from './AdminSubNavScroll';

/** 광고비 하위: 집계 화면·정산 설정(관리자만) */
export function AdminAdvertisingLayout() {
  const token = getToken();
  const location = useLocation();
  const [roleGate, setRoleGate] = useState<'loading' | 'admin' | 'marketer' | 'other' | 'network_error'>(
    'loading'
  );

  const probe = useCallback(() => {
    const t = getToken();
    if (!t) {
      setRoleGate('other');
      return;
    }
    setRoleGate('loading');
    void getMe(t)
      .then((u: { role?: string }) => {
        const r = u.role;
        if (r === 'ADMIN') setRoleGate('admin');
        else if (r === 'MARKETER') setRoleGate('marketer');
        else setRoleGate('other');
      })
      .catch((e: unknown) => {
        if (isAuthSessionExpiredError(e)) {
          setRoleGate('other');
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
    probe();
  }, [token, probe]);

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
          onClick={() => probe()}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50"
        >
          다시 시도
        </button>
      </div>
    );
  }
  if (roleGate !== 'admin' && roleGate !== 'marketer') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  const isAdmin = roleGate === 'admin';
  if (location.pathname.includes('/advertising/settings') && !isAdmin) {
    return <Navigate to="/admin/advertising" replace />;
  }

  return (
    <div className="min-w-0 w-full max-w-full">
      <AdminSubNavScroll aria-label="광고비 하위 메뉴">
        <NavLink to="/admin/advertising" end className={({ isActive }) => adminSubNavTabClassName(isActive)}>
          광고비
        </NavLink>
        {isAdmin ? (
          <NavLink
            to="/admin/advertising/settings"
            className={({ isActive }) => adminSubNavTabClassName(isActive)}
          >
            설정
          </NavLink>
        ) : null}
      </AdminSubNavScroll>
      <Outlet />
    </div>
  );
}
