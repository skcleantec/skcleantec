import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { PLATFORM_NAV_ITEMS, isPlatformNavActive } from '../../constants/platformNav';
import { clearPlatformToken } from '../../stores/platformAuth';

function SidebarNav({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1 px-3 py-2">
      {PLATFORM_NAV_ITEMS.map((item) => {
        const active = isPlatformNavActive(pathname, item.to);
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/platform/tenants'}
            onClick={onNavigate}
            className={[
              'flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors',
              active
                ? 'bg-white/10 font-medium text-white'
                : 'text-gray-400 hover:bg-white/5 hover:text-white',
            ].join(' ')}
          >
            <span className="text-base leading-none" aria-hidden>
              {item.icon}
            </span>
            {item.label}
          </NavLink>
        );
      })}
    </nav>
  );
}

export function PlatformLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pathname = location.pathname;

  const handleLogout = () => {
    clearPlatformToken();
    navigate('/platform/login');
  };

  const sidebar = (onNavigate?: () => void) => (
    <>
      <div className="px-4 py-5 border-b border-white/10">
        <Link to="/platform/tenants" onClick={onNavigate} className="block">
          <span className="text-lg font-bold tracking-tight text-white">
            청소<span className="text-blue-400">비서</span>
          </span>
          <span className="ml-2 text-xs font-normal text-gray-500">Platform</span>
        </Link>
      </div>
      <SidebarNav pathname={pathname} onNavigate={onNavigate} />
      <div className="mt-auto border-t border-white/10 p-3">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full rounded-lg px-3 py-2 text-left text-sm text-gray-400 transition hover:bg-white/5 hover:text-white"
        >
          로그아웃
        </button>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-gray-100">
      <aside className="hidden w-60 shrink-0 flex-col bg-gray-900 lg:flex">{sidebar()}</aside>

      {mobileNavOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            aria-label="메뉴 닫기"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-gray-900 shadow-xl lg:hidden">
            {sidebar(() => setMobileNavOpen(false))}
          </aside>
        </>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="staff-top-safe flex min-h-14 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4 pb-2 lg:hidden">
          <button
            type="button"
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
            aria-label="메뉴 열기"
            onClick={() => setMobileNavOpen(true)}
          >
            ☰
          </button>
          <span className="text-sm font-semibold text-gray-900">운영 콘솔</span>
        </header>

        <main className="min-h-0 flex-1 overflow-auto">
          <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
