import { NavLink, Outlet } from 'react-router-dom';
import { AdminSubNavScroll, adminSubNavTabClassName } from './AdminSubNavScroll';

/** 관리자 전용 > 전자계약 하위 라우팅 (`/admin/team-leaders/e-contracts/*`) */
export function AdminEContractLayout() {
  return (
    <div className="min-w-0 w-full max-w-full">
      <AdminSubNavScroll aria-label="전자계약 하위 메뉴">
        <NavLink to="/admin/team-leaders/e-contracts" end className={({ isActive }) => adminSubNavTabClassName(isActive)}>
          계약서
        </NavLink>
        <NavLink
          to="/admin/team-leaders/e-contracts/issuer-profile"
          className={({ isActive }) => adminSubNavTabClassName(isActive)}
        >
          발행측 정보
        </NavLink>
      </AdminSubNavScroll>
      <Outlet />
    </div>
  );
}
