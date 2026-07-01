import { useState, useEffect, useCallback, useMemo } from 'react';
import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom';
import { getToken, clearToken } from '../../stores/auth';
import { getMe, isAuthSessionExpiredError } from '../../api/auth';
import { resolveEffectiveStaffAdminFromMe, type StaffAdminMeFields } from '../../utils/staffAdminAccess';
import { isLikelyNetworkFailure } from '../../api/fetchNetwork';
import { ADMIN_TEAM_LEADERS_NAV_ITEMS } from '../../constants/adminTeamLeadersNav';
import { AdminCollapsibleSectionSideNav, type AdminSideNavItem } from './AdminSectionSideNav';
import { AdminSubNavScroll, adminSubNavTabClassName } from './AdminSubNavScroll';
import { useTenantCapabilities } from '../../hooks/useTenantCapabilities';
import { filterAdminSideNavItems } from '../../utils/filterAdminSideNavByFeatures';
import {
  filterAdminSideNavByPermissions,
  firstAllowedAdminSideNavPath,
} from '../../utils/filterAdminSideNavByPermissions';
import { canAccessAdminPath } from '@shared/marketerPermissionNav';

const ADMIN_TEAM_LEADERS_SIDE_NAV_COLLAPSED_KEY = 'skcleanteck:admin-team-leaders-side-nav-collapsed';

function MobileTeamLeadersSubNavTabs({ items }: { items: AdminSideNavItem[] }) {
  return (
    <>
      {items.flatMap((item) => {
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
  const location = useLocation();
  const { features } = useTenantCapabilities();
  const [roleGate, setRoleGate] = useState<'loading' | 'admin' | 'other' | 'network_error'>('loading');
  const [staffMe, setStaffMe] = useState<StaffAdminMeFields | null>(null);

  const navItems = useMemo(() => {
    const byFeature = filterAdminSideNavItems(ADMIN_TEAM_LEADERS_NAV_ITEMS, features);
    return filterAdminSideNavByPermissions(byFeature, staffMe);
  }, [features, staffMe]);

  const probeAdmin = useCallback(() => {
    const t = getToken();
    if (!t) {
      setRoleGate('other');
      setStaffMe(null);
      return;
    }
    setRoleGate('loading');
    void getMe(t)
      .then((u) => {
        const me: StaffAdminMeFields = {
          role: u.role,
          effectiveStaffAdminAccess: u.effectiveStaffAdminAccess,
          marketerAdminLevel: u.marketerAdminLevel,
          marketerPermissions: u.marketerPermissions ?? null,
        };
        setStaffMe(me);
        setRoleGate(resolveEffectiveStaffAdminFromMe(u) ? 'admin' : 'other');
      })
      .catch((e: unknown) => {
        setStaffMe(null);
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

  const pathAllowed = useMemo(
    () => canAccessAdminPath(staffMe?.role, staffMe?.marketerPermissions, location.pathname),
    [staffMe, location.pathname],
  );

  const fallbackPath = useMemo(
    () => firstAllowedAdminSideNavPath(ADMIN_TEAM_LEADERS_NAV_ITEMS, staffMe),
    [staffMe],
  );

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
  if (navItems.length === 0) {
    return (
      <div className="min-w-0 w-full max-w-full p-8 text-center text-fluid-sm text-gray-600">
        관리자 전용 메뉴에 접근할 권한이 없습니다.
      </div>
    );
  }
  if (!pathAllowed && fallbackPath) {
    return <Navigate to={fallbackPath} replace />;
  }

  return (
    <div className="min-w-0 w-full max-w-full">
      <div className="lg:hidden">
        <AdminSubNavScroll aria-label="관리자 전용 하위 메뉴">
          <MobileTeamLeadersSubNavTabs items={navItems} />
        </AdminSubNavScroll>
      </div>

      <div className="min-w-0 lg:flex lg:gap-2.5 xl:gap-3 2xl:gap-4">
        <div className="shrink-0 lg:self-stretch">
          <AdminCollapsibleSectionSideNav
            title="관리자 전용"
            items={navItems}
            aria-label="관리자 전용 하위 메뉴"
            collapseStorageKey={ADMIN_TEAM_LEADERS_SIDE_NAV_COLLAPSED_KEY}
          />
        </div>

        <div className="min-w-0 flex-1">
          {!pathAllowed ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-900">
              이 화면에 대한 권한이 없습니다.
            </div>
          ) : (
            <Outlet />
          )}
        </div>
      </div>
    </div>
  );
}
