import { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, Navigate, useLocation } from 'react-router-dom';
import { ADMIN_INQUIRIES_NAV_ITEMS } from '../../constants/adminInquiriesNav';
import { AdminCollapsibleSectionSideNav, type AdminSideNavItem } from './AdminSectionSideNav';
import { AdminSubNavScroll, adminSubNavTabClassName } from './AdminSubNavScroll';
import { getAdminNavBadges } from '../../api/adminNavBadges';
import { getToken } from '../../stores/auth';
import { getMe } from '../../api/auth';
import { useInboxRealtime } from '../../hooks/useInboxRealtime';
import { useTenantCapabilities } from '../../hooks/useTenantCapabilities';
import { filterAdminSideNavItems } from '../../utils/filterAdminSideNavByFeatures';
import {
  filterAdminSideNavByPermissions,
  firstAllowedAdminSideNavPath,
} from '../../utils/filterAdminSideNavByPermissions';
import { canAccessAdminPath } from '@shared/marketerPermissionNav';
import type { StaffAdminMeFields } from '../../utils/staffAdminAccess';

const ADMIN_INQUIRIES_SIDE_NAV_COLLAPSED_KEY = 'skcleanteck:admin-inquiries-side-nav-collapsed';
const REVIEW_PAYBACK_PATH = '/admin/inquiries/review-payback';
const CS_PATH = '/admin/inquiries/cs';

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
  const [reviewPaybackBadge, setReviewPaybackBadge] = useState(0);
  const [csPendingBadge, setCsPendingBadge] = useState(0);
  const [staffMe, setStaffMe] = useState<StaffAdminMeFields | null>(null);

  useEffect(() => {
    if (!token) {
      setStaffMe(null);
      return;
    }
    void getMe(token).then((u) => {
      setStaffMe({
        role: u.role,
        effectiveStaffAdminAccess: u.effectiveStaffAdminAccess,
        marketerAdminLevel: u.marketerAdminLevel,
        marketerPermissions: u.marketerPermissions ?? null,
      });
    });
  }, [token]);

  const refreshBadges = useCallback(async () => {
    if (!token) return;
    try {
      const r = await getAdminNavBadges(token);
      setReviewPaybackBadge(r.reviewPaybackUnseenCount);
      setCsPendingBadge(r.csPendingCount);
    } catch {
      /* ignore */
    }
  }, [token]);

  useEffect(() => {
    void refreshBadges();
  }, [refreshBadges]);

  useInboxRealtime(token, () => void refreshBadges(), Boolean(token));

  const navItems = useMemo(() => {
    const withBadge = ADMIN_INQUIRIES_NAV_ITEMS.map((item) => {
      if (item.type === 'link' && item.to === REVIEW_PAYBACK_PATH) {
        return { ...item, badge: reviewPaybackBadge };
      }
      if (item.type === 'link' && item.to === CS_PATH) {
        return { ...item, badge: csPendingBadge };
      }
      return item;
    });
    const byFeature = filterAdminSideNavItems(withBadge, features);
    return filterAdminSideNavByPermissions(byFeature, staffMe);
  }, [reviewPaybackBadge, csPendingBadge, features, staffMe]);

  const pathAllowed = useMemo(
    () => canAccessAdminPath(staffMe?.role, staffMe?.marketerPermissions, location.pathname),
    [staffMe, location.pathname],
  );

  const fallbackPath = useMemo(
    () => firstAllowedAdminSideNavPath(ADMIN_INQUIRIES_NAV_ITEMS, staffMe),
    [staffMe],
  );

  if (staffMe && navItems.length === 0) {
    return (
      <div className="min-w-0 w-full max-w-full p-8 text-center text-fluid-sm text-gray-600">
        서비스접수 메뉴에 접근할 권한이 없습니다.
      </div>
    );
  }
  if (staffMe && !pathAllowed && fallbackPath && fallbackPath !== location.pathname.split('?')[0]) {
    return <Navigate to={fallbackPath} replace />;
  }

  return (
    <div className="min-w-0 w-full max-w-full">
      <div className="lg:hidden">
        <AdminSubNavScroll aria-label="서비스접수 하위 메뉴">
          <MobileInquirySubNavTabs items={navItems} />
        </AdminSubNavScroll>
      </div>

      <div className="min-w-0 w-full max-w-full lg:flex lg:gap-2.5 xl:gap-3 2xl:gap-4">
        <div className="shrink-0 lg:self-stretch">
          <AdminCollapsibleSectionSideNav
            title="서비스접수"
            items={navItems}
            aria-label="서비스접수 하위 메뉴"
            collapseStorageKey={ADMIN_INQUIRIES_SIDE_NAV_COLLAPSED_KEY}
          />
        </div>

        <div className="min-w-0 flex-1 overflow-x-hidden">
          {!pathAllowed && staffMe ? (
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
