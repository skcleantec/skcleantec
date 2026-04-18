import { useState, useEffect } from 'react';
import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { getToken } from '../../stores/auth';
import { getMe } from '../../api/auth';

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `inline-flex items-center px-3 py-2 text-sm font-medium rounded-t border-b-2 -mb-px whitespace-nowrap ${
    isActive
      ? 'border-blue-600 text-gray-900 bg-white'
      : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
  }`;

/** 관리자설정(/admin/team-leaders/*) — 관리자만 */
export function AdminTeamLeadersLayout() {
  const token = getToken();
  const [roleGate, setRoleGate] = useState<'loading' | 'admin' | 'other'>('loading');

  useEffect(() => {
    if (!token) {
      setRoleGate('other');
      return;
    }
    getMe(token)
      .then((u: { role?: string }) => setRoleGate(u.role === 'ADMIN' ? 'admin' : 'other'))
      .catch(() => setRoleGate('other'));
  }, [token]);

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
  if (roleGate !== 'admin') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return (
    <div className="min-w-0">
      <nav
        className="flex flex-wrap gap-1 border-b border-gray-200 mb-6"
        aria-label="관리자설정 하위 메뉴"
      >
        <NavLink to="/admin/team-leaders" end className={tabClass}>
          사용자 목록
        </NavLink>
        <NavLink to="/admin/team-leaders/page-settings" className={tabClass}>
          페이지 설정
        </NavLink>
        <NavLink to="/admin/team-leaders/inquiry-delete" className={tabClass}>
          접수건 삭제
        </NavLink>
        <NavLink to="/admin/team-leaders/external-companies" className={tabClass}>
          타업체 등록
        </NavLink>
        <NavLink to="/admin/team-leaders/external-settlement" className={tabClass}>
          타업체 정산
        </NavLink>
      </nav>
      <Outlet />
    </div>
  );
}
