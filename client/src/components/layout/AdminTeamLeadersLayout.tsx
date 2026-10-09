import { useEffect, useMemo, useState } from 'react';
import { matchPath, Outlet, Navigate, useLocation } from 'react-router-dom';
import { getToken } from '../../stores/auth';
import { resolveEffectiveStaffAdminFromMe, canBulkDeleteInquiriesFromMe } from '../../utils/staffAdminAccess';
import { ADMIN_TEAM_LEADERS_NAV_ITEMS } from '../../constants/adminTeamLeadersNav';
import { AdminCollapsibleSectionSideNav } from './AdminSectionSideNav';
import {
  AdminTeamLeadersMobileMenuProvider,
  AdminTeamLeadersMobileSubNavBar,
} from './AdminTeamLeadersMobileSubNav';
import { useTenantCapabilities } from '../../hooks/useTenantCapabilities';
import { useAdminStaffSession } from '../../hooks/useAdminStaffSession';
import { filterAdminSideNavItems } from '../../utils/filterAdminSideNavByFeatures';
import {
  filterAdminSideNavByPermissions,
  firstAllowedAdminSideNavPath,
} from '../../utils/filterAdminSideNavByPermissions';
import { canAccessAdminPath } from '@shared/marketerPermissionNav';
import { fetchTenantPgState } from '../../api/cardPayment';

const ADMIN_TEAM_LEADERS_SIDE_NAV_COLLAPSED_KEY = 'skcleanteck:admin-team-leaders-side-nav-collapsed';

/** 관리자 전용(/admin/team-leaders/*) — PC: 왼쪽 접이식 사이드 / 모바일: 햄버거 드로어 */
export function AdminTeamLeadersLayout() {
  const token = getToken();
  const location = useLocation();
  const { features } = useTenantCapabilities();
  const { ready, staffMe } = useAdminStaffSession();
  const [pgConnected, setPgConnected] = useState(false);
  const [pgLoaded, setPgLoaded] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    void fetchTenantPgState(token)
      .then((res) => {
        if (!cancelled) setPgConnected(res.credential.connected);
      })
      .catch(() => {
        if (!cancelled) setPgConnected(false);
      })
      .finally(() => {
        if (!cancelled) setPgLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const hasTeamLeadersAccess = useMemo(() => {
    if (resolveEffectiveStaffAdminFromMe(staffMe)) return true;
    return canBulkDeleteInquiriesFromMe(staffMe);
  }, [staffMe]);

  const navItems = useMemo(() => {
    const source = pgConnected
      ? ADMIN_TEAM_LEADERS_NAV_ITEMS
      : ADMIN_TEAM_LEADERS_NAV_ITEMS.filter((item) => item.type !== 'group' || item.label !== '카드결재');
    const byFeature = filterAdminSideNavItems(source, features);
    return filterAdminSideNavByPermissions(byFeature, staffMe);
  }, [features, pgConnected, staffMe]);

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
  if (pgLoaded && !pgConnected && location.pathname.startsWith('/admin/team-leaders/card-payment')) {
    return <Navigate to="/admin/team-leaders/pg-onboarding" replace />;
  }

  const embedMobileMenuInPageHeader = Boolean(
    matchPath({ path: '/admin/team-leaders', end: true }, location.pathname),
  );

  return (
    <AdminTeamLeadersMobileMenuProvider items={navItems}>
      <div className="min-w-0 w-full max-w-full">
        {!embedMobileMenuInPageHeader ? (
          <div className="lg:hidden">
            {ready ? (
              <AdminTeamLeadersMobileSubNavBar />
            ) : (
              <div className="mb-2 h-8 rounded-lg bg-slate-100 animate-pulse" aria-hidden />
            )}
          </div>
        ) : null}

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
    </AdminTeamLeadersMobileMenuProvider>
  );
}
