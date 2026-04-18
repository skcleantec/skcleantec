import { NavLink, Outlet } from 'react-router-dom';

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `inline-flex items-center px-3 py-2 text-sm font-medium rounded-t border-b-2 -mb-px whitespace-nowrap ${
    isActive
      ? 'border-blue-600 text-gray-900 bg-white'
      : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
  }`;

/** 접수 목록(/admin/inquiries/*) — 본문 상단에서 발주서 목록만 빠르게 전환 (발급·설정은 GNB 「발주서」) */
export function AdminInquiriesLayout() {
  return (
    <div className="min-w-0 w-full max-w-full">
      <nav
        className="mb-6 flex min-w-0 flex-nowrap items-center gap-1 overflow-x-auto overflow-y-hidden overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden border-b border-gray-200 sm:flex-wrap sm:overflow-visible"
        style={{ WebkitOverflowScrolling: 'touch' }}
        aria-label="접수 목록 하위 메뉴"
      >
        <NavLink to="/admin/inquiries" end className={tabClass}>
          접수 목록
        </NavLink>
        <NavLink to="/admin/inquiries/order-forms" className={tabClass}>
          발주서 목록
        </NavLink>
      </nav>
      <Outlet />
    </div>
  );
}
