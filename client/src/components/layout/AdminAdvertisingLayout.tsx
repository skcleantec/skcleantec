import { useMemo } from 'react';
import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom';
import { getToken } from '../../stores/auth';
import { hasStaffPermission } from '../../utils/staffAdminAccess';
import { getAdminAdvertisingNavItems } from '../../constants/adminAdvertisingNav';
import { AdminCollapsibleSectionSideNav } from './AdminSectionSideNav';
import { AdminSubNavScroll, adminSubNavTabClassName } from './AdminSubNavScroll';
import { useTenantCapabilities } from '../../hooks/useTenantCapabilities';
import { useAdminStaffSession } from '../../hooks/useAdminStaffSession';
import { filterAdminSideNavItems } from '../../utils/filterAdminSideNavByFeatures';
import {
  filterAdminSideNavByPermissions,
  firstAllowedAdminSideNavPath,
} from '../../utils/filterAdminSideNavByPermissions';
import { canAccessAdminPath } from '@shared/marketerPermissionNav';

const ADMIN_ADVERTISING_SIDE_NAV_COLLAPSED_KEY = 'skcleanteck:admin-advertising-side-nav-collapsed';

function MobileAdvertisingSubNavTabs({ items }: { items: ReturnType<typeof getAdminAdvertisingNavItems> }) {
  return (
    <>
      {items.map((item) =>
        item.type === 'link' ? (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            title={item.title}
            className={({ isActive }) => adminSubNavTabClassName(isActive)}
          >
            {item.label}
          </NavLink>
        ) : null
      )}
    </>
  );
}

/** 광고비(/admin/advertising/*) — PC: 왼쪽 접이식 사이드 / 모바일: 가로 하위 탭 */
export function AdminAdvertisingLayout() {
  const token = getToken();
  const location = useLocation();
  const { features } = useTenantCapabilities();
  const { ready, role, staffMe } = useAdminStaffSession();

  const showSettingsNav = hasStaffPermission(staffMe, 'ads.settings');
  const navItems = useMemo(() => {
    const raw = getAdminAdvertisingNavItems(showSettingsNav);
    const byFeature = filterAdminSideNavItems(raw, features);
    return filterAdminSideNavByPermissions(byFeature, staffMe);
  }, [showSettingsNav, features, staffMe]);

  const pathAllowed = useMemo(
    () => canAccessAdminPath(staffMe?.role, staffMe?.marketerPermissions, location.pathname),
    [staffMe, location.pathname],
  );

  const fallbackPath = useMemo(
    () => firstAllowedAdminSideNavPath(getAdminAdvertisingNavItems(showSettingsNav), staffMe),
    [staffMe, showSettingsNav],
  );

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (ready && role !== 'ADMIN' && role !== 'MARKETER') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  if (ready && navItems.length === 0) {
    return (
      <div className="min-w-0 w-full max-w-full p-8 text-center text-fluid-sm text-gray-600">
        광고비 메뉴에 접근할 권한이 없습니다.
      </div>
    );
  }

  if (ready && !pathAllowed && fallbackPath) {
    return <Navigate to={fallbackPath} replace />;
  }

  return (
    <div className="min-w-0 w-full max-w-full">
      <div className="lg:hidden">
        {ready ? (
          <AdminSubNavScroll aria-label="광고비 하위 메뉴">
            <MobileAdvertisingSubNavTabs items={navItems} />
          </AdminSubNavScroll>
        ) : (
          <div className="h-9 rounded-lg bg-slate-100 animate-pulse" aria-hidden />
        )}
      </div>

      <div className="min-w-0 lg:flex lg:gap-2.5 xl:gap-3 2xl:gap-4">
        <div className="shrink-0 lg:self-stretch">
          {ready ? (
            <AdminCollapsibleSectionSideNav
              title="광고비"
              items={navItems}
              aria-label="광고비 하위 메뉴"
              collapseStorageKey={ADMIN_ADVERTISING_SIDE_NAV_COLLAPSED_KEY}
            />
          ) : (
            <div className="hidden lg:block w-44 h-48 rounded-xl bg-slate-100 animate-pulse" aria-hidden />
          )}
        </div>

        <div className="min-w-0 flex-1">
          {ready && !pathAllowed ? (
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
