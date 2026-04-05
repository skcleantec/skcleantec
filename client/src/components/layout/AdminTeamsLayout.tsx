import { NavLink, Outlet } from 'react-router-dom';

const tabClass = ({ isActive }: { isActive: boolean }) =>
  `inline-flex items-center px-3 py-2 text-sm font-medium rounded-t border-b-2 -mb-px whitespace-nowrap ${
    isActive
      ? 'border-blue-600 text-gray-900 bg-white'
      : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'
  }`;

export function AdminTeamsLayout() {
  return (
    <div className="min-w-0">
      <nav
        className="flex flex-wrap gap-1 border-b border-gray-200 mb-6"
        aria-label="팀 관리 하위 메뉴"
      >
        <NavLink to="/admin/teams" end className={tabClass}>
          팀원
        </NavLink>
        <NavLink to="/admin/teams/holidays" className={tabClass}>
          휴일 캘린더
        </NavLink>
      </nav>
      <Outlet />
    </div>
  );
}
