import { useState, useEffect, useCallback } from 'react';
import { NavLink, Outlet, Navigate } from 'react-router-dom';
import { getToken, clearToken } from '../../stores/auth';
import { getMe, isAuthSessionExpiredError } from '../../api/auth';
import { isLikelyNetworkFailure } from '../../api/fetchNetwork';
import { ADMIN_TEAM_LEADERS_NAV_ITEMS } from '../../constants/adminTeamLeadersNav';
import { AdminCollapsibleSectionSideNav } from './AdminSectionSideNav';
import { AdminSubNavScroll, adminSubNavTabClassName } from './AdminSubNavScroll';

const ADMIN_TEAM_LEADERS_SIDE_NAV_COLLAPSED_KEY = 'skcleanteck:admin-team-leaders-side-nav-collapsed';

function MobileTeamLeadersSubNavTabs() {
  return (
    <>
      {ADMIN_TEAM_LEADERS_NAV_ITEMS.flatMap((item) => {
        if (item.type === 'link') {
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={item.title}
              className={({ isActive }) => adminSubNavTabClassName(isActive)}
            >
              {item.label}
            </NavLink>
          );
        }
        return item.children.map((child) => (
          <NavLink
            key={child.to}
            to={child.to}
            end={child.end}
            title={child.title ?? child.label}
            className={({ isActive }) => adminSubNavTabClassName(isActive)}
          >
            {child.label}
          </NavLink>
        ));
      })}
    </>
  );
}

/** 관리자 전용(/admin/team-leaders/*) — PC: 왼쪽 접이식 사이드 / 모바일: 가로 하위 탭 */
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
      <div className="lg:hidden">
        <AdminSubNavScroll aria-label="관리자 전용 하위 메뉴">
          <MobileTeamLeadersSubNavTabs />
        </AdminSubNavScroll>
      </div>

      <div className="min-w-0 lg:flex lg:items-start lg:gap-2.5 xl:gap-3 2xl:gap-4">
        <div className="shrink-0 lg:-ml-4">
          <AdminCollapsibleSectionSideNav
            title="관리자 전용"
            items={ADMIN_TEAM_LEADERS_NAV_ITEMS}
            aria-label="관리자 전용 하위 메뉴"
            collapseStorageKey={ADMIN_TEAM_LEADERS_SIDE_NAV_COLLAPSED_KEY}
          />
        </div>

        <div className="min-w-0 flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
