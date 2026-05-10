import { useState, useEffect, useCallback } from 'react';
import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { getToken, clearToken } from '../../stores/auth';
import { getMe, isAuthSessionExpiredError } from '../../api/auth';
import { isLikelyNetworkFailure } from '../../api/fetchNetwork';
import { AdminSubNavScroll, adminSubNavTabClassName } from './AdminSubNavScroll';

/** 사용자 등록(/admin/team-leaders/*) — 관리자만 */
export function AdminTeamLeadersLayout() {
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
      <AdminSubNavScroll aria-label="사용자 등록 하위 메뉴">
        <NavLink to="/admin/team-leaders" end className={({ isActive }) => adminSubNavTabClassName(isActive)}>
          사용자 등록
        </NavLink>
        <NavLink
          to="/admin/team-leaders/page-settings"
          className={({ isActive }) => adminSubNavTabClassName(isActive)}
        >
          페이지 설정
        </NavLink>
        <NavLink
          to="/admin/team-leaders/inquiry-delete"
          className={({ isActive }) => adminSubNavTabClassName(isActive)}
        >
          접수건 삭제
        </NavLink>
        <NavLink
          to="/admin/team-leaders/external-companies"
          className={({ isActive }) => adminSubNavTabClassName(isActive)}
        >
          타업체 등록
        </NavLink>
        <NavLink
          to="/admin/team-leaders/external-settlement"
          className={({ isActive }) => adminSubNavTabClassName(isActive)}
        >
          타업체 정산
        </NavLink>
        <NavLink
          to="/admin/team-leaders/payroll"
          className={({ isActive }) => adminSubNavTabClassName(isActive)}
        >
          월정산표
        </NavLink>
        <NavLink to="/admin/team-leaders/leader-stats" className={({ isActive }) => adminSubNavTabClassName(isActive)}>
          팀장
        </NavLink>
        <NavLink to="/admin/team-leaders/team-members" className={({ isActive }) => adminSubNavTabClassName(isActive)}>
          팀원
        </NavLink>
        <NavLink
          to="/admin/team-leaders/holiday-calendar"
          className={({ isActive }) => adminSubNavTabClassName(isActive)}
        >
          휴일 캘린더
        </NavLink>
      </AdminSubNavScroll>
      <Outlet />
    </div>
  );
}
