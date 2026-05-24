import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { clearPlatformToken } from '../../stores/platformAuth';

export function PlatformLayout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    clearPlatformToken();
    navigate('/platform/login');
  };

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 text-fluid-sm rounded whitespace-nowrap ${isActive ? 'bg-gray-800 text-white' : 'text-gray-600 hover:text-gray-900'}`;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4 min-w-0">
          <div className="flex items-center gap-4 min-w-0">
            <span className="text-fluid-sm font-semibold text-gray-900 shrink-0">SK 플랫폼</span>
            <nav className="flex gap-1 overflow-x-auto">
              <NavLink to="/platform/tenants" className={navClass}>
                업체 관리
              </NavLink>
            </nav>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="text-fluid-xs text-gray-500 hover:text-gray-800 shrink-0"
          >
            로그아웃
          </button>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6 w-full min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}
