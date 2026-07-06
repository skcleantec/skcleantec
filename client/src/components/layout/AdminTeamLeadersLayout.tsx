import { useMemo } from 'react';
import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom';
import { getToken } from '../../stores/auth';
import { resolveEffectiveStaffAdminFromMe } from '../../utils/staffAdminAccess';
import { ADMIN_TEAM_LEADERS_NAV_ITEMS } from '../../constants/adminTeamLeadersNav';
import { AdminCollapsibleSectionSideNav, type AdminSideNavItem } from './AdminSectionSideNav';
import { AdminSubNavScroll, adminSubNavTabClassName } from './AdminSubNavScroll';
import { useTenantCapabilities } from '../../hooks/useTenantCapabilities';
import { useAdminStaffSession } from '../../hooks/useAdminStaffSession';
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
  const { ready, staffMe } = useAdminStaffSession();

  const hasTeamLeadersAccess = useMemo(
    () => resolveEffectiveStaffAdminFromMe(staffMe),
    [staffMe],
  );

  const navItems = useMemo(() => {
    const byFeature = filterAdminSideNavItems(ADMIN_TEAM_LEADERS_NAV_ITEMS, features);
    return filterAdminSideNavByPermissions(byFeature, staffMe);
  }, [features, staffMe]);

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
  if (ready && !hasTeamLeadersAccess) {
    return <Navigate to="/admin/dashboard" replace />;
  }
  if (ready && staffMe && navItems.length === 0) {
    return (
      <div className="min-w-0 w-full max-w-full p-8 text-center text-fluid-sm text-gray-600">
        관리자 전용 메뉴에 접근할 권한이 없습니다.
      </div>
    );
  }
  if (ready && staffMe && !pathAllowed && fallbackPath && fallbackPath !== location.pathname.split('?')[0]) {
    return <Navigate to={fallbackPath} replace />;
  }

  return (
    <div className="min-w-0 w-full max-w-full">
      <div className="lg:hidden">
        {ready ? (
          <AdminSubNavScroll aria-label="관리자 전용 하위 메뉴">
            <MobileTeamLeadersSubNavTabs items={navItems} />
          </AdminSubNavScroll>
        ) : (
          <div className="h-9 rounded-lg bg-slate-100 animate-pulse" aria-hidden />
        )}
      </div>

      <div className="min-w-0 lg:flex lg:gap-2.5 xl:gap-3 2xl:gap-4">
        <div className="shrink-0 lg:self-stretch">
          {ready ? (
            <AdminCollapsibleSectionSideNav
              title="관리자 전용"
              items={navItems}
              aria-label="관리자 전용 하위 메뉴"
              collapseStorageKey={ADMIN_TEAM_LEADERS_SIDE_NAV_COLLAPSED_KEY}
            />
          ) : (
            <div className="hidden lg:block w-44 h-48 rounded-xl bg-slate-100 animate-pulse" aria-hidden />
          )}
        </div>

        <div className="min-w-0 flex-1">
          {ready && staffMe && !pathAllowed ? (
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
