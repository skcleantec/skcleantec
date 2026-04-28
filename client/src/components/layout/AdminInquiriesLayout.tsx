import { NavLink, Outlet } from 'react-router-dom';
import { AdminSubNavScroll, adminSubNavTabClassName } from './AdminSubNavScroll';

/** 서비스접수(/admin/inquiries/*) — 접수·부재현황·발주서 발급/목록·발주서설정 */
export function AdminInquiriesLayout() {
  return (
    <div className="min-w-0 w-full max-w-full">
      <AdminSubNavScroll aria-label="서비스접수 하위 메뉴">
        <NavLink to="/admin/inquiries" end className={({ isActive }) => adminSubNavTabClassName(isActive)}>
          서비스접수
        </NavLink>
        <NavLink to="/admin/inquiries/followup" className={({ isActive }) => adminSubNavTabClassName(isActive)}>
          부재·보류
        </NavLink>
        <NavLink to="/admin/inquiries/order-forms" className={({ isActive }) => adminSubNavTabClassName(isActive)}>
          발주서 목록
        </NavLink>
        <NavLink to="/admin/inquiries/order-issue" className={({ isActive }) => adminSubNavTabClassName(isActive)}>
          발주서 발급
        </NavLink>
        <NavLink
          to="/admin/inquiries/order-customer-preview"
          title="발주서 폼 설정·미리보기"
          className={({ isActive }) => `${adminSubNavTabClassName(isActive)} shrink-0 sm:ml-auto`}
        >
          발주서설정
        </NavLink>
      </AdminSubNavScroll>
      <Outlet />
    </div>
  );
}
