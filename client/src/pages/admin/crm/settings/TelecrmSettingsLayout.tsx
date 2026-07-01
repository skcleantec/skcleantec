import { NavLink, Outlet } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { openTelecrmWindow } from '../../../../utils/openTelecrmWindow';

const NAV = [
  { to: '/admin/crm/settings/scripts', label: '스크립트' },
  { to: '/admin/crm/settings/pricing', label: '가격' },
  { to: '/admin/crm/settings/general', label: '기본 단가' },
] as const;

export function TelecrmSettingsLayout() {
  return (
    <div className="min-w-0 w-full max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">텔레CRM 설정</h1>
          <p className="mt-1 text-fluid-sm text-gray-500">
            스크립트·가격 카테고리를 등록하면 텔레CRM 작업 화면에 바로 반영됩니다.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => openTelecrmWindow()}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-fluid-sm text-gray-800 hover:bg-gray-50"
          >
            텔레CRM 열기
          </button>
          <Link
            to="/admin/dashboard"
            className="rounded-lg border border-gray-300 px-4 py-2 text-fluid-sm text-gray-600 hover:bg-gray-50"
          >
            대시보드
          </Link>
        </div>
      </div>

      <nav className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `rounded-lg px-4 py-2 text-fluid-sm font-medium ${
                isActive ? 'bg-slate-900 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}
