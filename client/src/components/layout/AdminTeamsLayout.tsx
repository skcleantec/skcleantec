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

/** 팀 관리(/admin/teams/*) — 관리자만. 권한은 레이아웃에서 한 번만 확인(탭 전환 시 자식마다 getMe 반복·실패 시 대시보드로 튕김 방지). */
export function AdminTeamsLayout() {
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
        aria-label="팀 관리 하위 메뉴"
      >
        <NavLink to="/admin/teams/leader-stats" className={tabClass}>
          팀장
        </NavLink>
        <NavLink to="/admin/teams" end className={tabClass}>
          팀원
        </NavLink>
        <NavLink to="/admin/teams/holidays" className={tabClass}>
          휴일 캘린더
        </NavLink>
      </nav>
      <Outlet />
    </div>
  );
}
