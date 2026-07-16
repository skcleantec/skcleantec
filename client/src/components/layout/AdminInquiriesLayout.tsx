import { useMemo } from 'react';
import { matchPath, Outlet, Navigate, useLocation } from 'react-router-dom';
import { ADMIN_INQUIRIES_NAV_ITEMS } from '../../constants/adminInquiriesNav';
import { AdminCollapsibleSectionSideNav } from './AdminSectionSideNav';
import {
  AdminInquiriesMobileMenuProvider,
  AdminInquiriesMobileSubNavBar,
} from './AdminInquiriesMobileSubNav';
import { getToken } from '../../stores/auth';
import { useTenantCapabilities } from '../../hooks/useTenantCapabilities';
import { useAdminStaffSession } from '../../hooks/useAdminStaffSession';
import { filterAdminSideNavItems } from '../../utils/filterAdminSideNavByFeatures';
import {
  filterAdminSideNavByPermissions,
  firstAllowedAdminSideNavPath,
} from '../../utils/filterAdminSideNavByPermissions';
import { canAccessAdminPath } from '@shared/marketerPermissionNav';
import { useInquiriesSubNavBadges } from '../../utils/adminInquiriesNavBadges';

const ADMIN_INQUIRIES_SIDE_NAV_COLLAPSED_KEY = 'skcleanteck:admin-inquiries-side-nav-collapsed';
const REVIEW_PAYBACK_PATH = '/admin/inquiries/review-payback';
const CS_PATH = '/admin/inquiries/cs';
const LEADS_PATH = '/admin/inquiries/leads';

/** 접수목록(/admin/inquiries/*) — PC: 왼쪽 계층 메뉴 / 모바일: 햄버거 드로어 */
export function AdminInquiriesLayout() {
  const token = getToken();
  const location = useLocation();
  const { features } = useTenantCapabilities();
  const { ready, staffMe } = useAdminStaffSession();
  const { badges } = useInquiriesSubNavBadges(ready && Boolean(token));

  const navItems = useMemo(() => {
    const withBadge = ADMIN_INQUIRIES_NAV_ITEMS.map((item) => {
      if (item.type === 'link' && item.to === REVIEW_PAYBACK_PATH) {
        return { ...item, badge: badges.reviewPaybackUnseenCount };
      }
      if (item.type === 'link' && item.to === CS_PATH) {
        return { ...item, badge: badges.csPendingCount };
      }
      if (item.type === 'link' && item.to === LEADS_PATH) {
        return { ...item, badge: badges.leadsPendingCount };
      }
      return item;
    });
    const byFeature = filterAdminSideNavItems(withBadge, features);
    return filterAdminSideNavByPermissions(byFeature, staffMe);
  }, [badges, features, staffMe]);

  const pathAllowed = useMemo(
    () => canAccessAdminPath(staffMe?.role, staffMe?.marketerPermissions, location.pathname),
    [staffMe, location.pathname],
  );

  const fallbackPath = useMemo(
    () => firstAllowedAdminSideNavPath(ADMIN_INQUIRIES_NAV_ITEMS, staffMe),
    [staffMe],
  );

  if (ready && staffMe && navItems.length === 0) {
    return (
      <div className="min-w-0 w-full max-w-full p-8 text-center text-fluid-sm text-gray-600">
        서비스접수 메뉴에 접근할 권한이 없습니다.
      </div>
    );
  }
  if (ready && staffMe && !pathAllowed && fallbackPath && fallbackPath !== location.pathname.split('?')[0]) {
    return <Navigate to={fallbackPath} replace />;
  }

  const embedMobileMenuInPageHeader = Boolean(
    matchPath({ path: '/admin/inquiries', end: true }, location.pathname),
  );

  return (
    <AdminInquiriesMobileMenuProvider items={navItems}>
    <div className="min-w-0 w-full max-w-full">
      {!embedMobileMenuInPageHeader ? (
        <div className="lg:hidden">
          {ready ? (
            <AdminInquiriesMobileSubNavBar />
          ) : (
            <div className="mb-2 h-8 rounded-lg bg-slate-100 animate-pulse" aria-hidden />
          )}
        </div>
      ) : null}

      <div className="min-w-0 w-full max-w-full lg:flex lg:gap-2.5 xl:gap-3 2xl:gap-4">
        <div className="shrink-0 lg:self-stretch">
          {ready ? (
            <AdminCollapsibleSectionSideNav
              title="서비스접수"
              items={navItems}
              aria-label="서비스접수 하위 메뉴"
              collapseStorageKey={ADMIN_INQUIRIES_SIDE_NAV_COLLAPSED_KEY}
            />
          ) : (
            <div className="hidden lg:block w-44 h-48 rounded-xl bg-slate-100 animate-pulse" aria-hidden />
          )}
        </div>

        <div className="min-w-0 flex-1 max-w-full lg:overflow-x-hidden">
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
    </AdminInquiriesMobileMenuProvider>
  );
}
