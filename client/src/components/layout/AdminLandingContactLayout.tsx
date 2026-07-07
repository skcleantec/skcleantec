import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { AdminSubNavScroll, adminSubNavTabClassName } from './AdminSubNavScroll';
import { useAdminStaffSession } from '../../hooks/useAdminStaffSession';
import { hasStaffPermission } from '../../utils/staffAdminAccess';

const LEADS_LIST_PATH = '/admin/inquiries/leads';
const LEADS_SETTINGS_PATH = '/admin/inquiries/leads/settings';

/** 문의내역 — 목록 / 문의 폼·링크 탭 */
export function AdminLandingContactLayout() {
  const location = useLocation();
  const { ready, staffMe } = useAdminStaffSession();
  const canEditSettings = hasStaffPermission(staffMe, 'leads.edit');

  if (ready && location.pathname.startsWith(LEADS_SETTINGS_PATH) && !canEditSettings) {
    return <Navigate to={LEADS_LIST_PATH} replace />;
  }

  return (
    <div className="min-w-0 w-full max-w-full">
      <AdminSubNavScroll aria-label="문의내역 하위 메뉴">
        <NavLink to={LEADS_LIST_PATH} end className={({ isActive }) => adminSubNavTabClassName(isActive)}>
          문의내역
        </NavLink>
        {canEditSettings ? (
          <NavLink
            to={LEADS_SETTINGS_PATH}
            className={({ isActive }) => adminSubNavTabClassName(isActive)}
          >
            문의 폼·링크
          </NavLink>
        ) : null}
      </AdminSubNavScroll>
      <Outlet />
    </div>
  );
}
