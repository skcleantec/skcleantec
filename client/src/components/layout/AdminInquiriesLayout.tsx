import { useMemo } from 'react';
import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom';
import { ADMIN_INQUIRIES_NAV_ITEMS } from '../../constants/adminInquiriesNav';
import { AdminCollapsibleSectionSideNav, type AdminSideNavItem } from './AdminSectionSideNav';
import { AdminSubNavScroll, adminSubNavTabClassName } from './AdminSubNavScroll';
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

function MobileInquirySubNavTabs({ items }: { items: AdminSideNavItem[] }) {
  return (
    <>
      {items.flatMap((item) => {
        if (item.type === 'link') {
          const badge = item.badge ?? 0;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={item.title}
              className={({ isActive }) => adminSubNavTabClassName(isActive)}
            >
              <span className="inline-flex items-center gap-1">
                {item.label}
                {badge > 0 ? (
                  <span className="rounded-full bg-red-600 px-1 py-0.5 text-[9px] font-semibold text-white tabular-nums">
                    {badge > 99 ? '99+' : badge}
                  </span>
                ) : null}
              </span>
            </NavLink>
          );
        }
        return item.children.map((child) => (
          <NavLink
            key={child.to}
            to={child.to}
            end={child.end}
            title={child.title}
            className={({ isActive }) =>
              adminSubNavTabClassName(
                isActive,
                child.to === '/admin/inquiries/order-customer-preview' ||
                child.to === '/admin/inquiries/order-customer-link'
                  ? 'shrink-0'
                  : undefined,
              )
            }
          >
            {child.label}
          </NavLink>
        ));
      })}
    </>
  );
}

/** 접수목록(/admin/inquiries/*) — PC: 왼쪽 계층 메뉴 / 모바일: 가로 하위 탭 */
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

  return (
    <div className="min-w-0 w-full max-w-full">
      <div className="lg:hidden">
        {ready ? (
          <AdminSubNavScroll aria-label="서비스접수 하위 메뉴">
            <MobileInquirySubNavTabs items={navItems} />
          </AdminSubNavScroll>
        ) : (
          <div className="h-9 rounded-lg bg-slate-100 animate-pulse" aria-hidden />
        )}
      </div>

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

        <div className="min-w-0 flex-1 overflow-x-hidden">
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
