import { useState, useEffect } from 'react';
import { Outlet, useNavigate, NavLink, useLocation } from 'react-router-dom';
import { clearToken, getToken } from '../../stores/auth';
import { getUnreadCount } from '../../api/messages';

export function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const isMessagesPage = location.pathname.includes('/messages');

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const fetch = () => {
      getUnreadCount(token).then((r) => setUnreadCount(r.count)).catch(() => {});
    };
    fetch();
    (window as { __refreshUnreadCount?: () => void }).__refreshUnreadCount = fetch;
    const id = isMessagesPage ? setInterval(fetch, 15000) : undefined;
    return () => {
      delete (window as { __refreshUnreadCount?: () => void }).__refreshUnreadCount;
      if (id) clearInterval(id);
    };
  }, [isMessagesPage]);

  const handleLogout = () => {
    clearToken();
    navigate('/admin/login');
  };

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `inline-flex items-center px-2 sm:px-3 py-2 text-[clamp(0.6rem,1.4vw,0.875rem)] font-medium rounded whitespace-nowrap shrink-0 flex-none break-keep ${isActive ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:text-gray-900'}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3 overflow-x-auto">
        <div className="max-w-6xl mx-auto flex flex-nowrap items-center justify-between gap-2 min-w-max">
          <div className="flex flex-nowrap items-center gap-1 sm:gap-2 min-w-0 flex-1 overflow-x-auto overflow-y-hidden">
            <h1 className="text-[clamp(0.75rem,1.8vw,1.125rem)] font-semibold text-gray-800 whitespace-nowrap shrink-0 flex-none">SK클린텍 관리자</h1>
            <nav
              className="flex flex-row flex-nowrap items-center gap-1 min-w-0 overflow-x-auto overflow-y-hidden flex-1"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              <NavLink to="/admin/dashboard" className={navClass}>대시보드</NavLink>
              <NavLink to="/admin/inquiries" className={navClass}>접수 목록</NavLink>
              <NavLink to="/admin/schedule" className={navClass}>스케줄 표</NavLink>
              <NavLink to="/admin/team-leaders" className={navClass}>사용자관리</NavLink>
              <NavLink to="/admin/orderforms" className={navClass}>
                발주서
              </NavLink>
              <NavLink to="/admin/cs" className={navClass}>C/S 관리</NavLink>
              <NavLink to="/admin/advertising" className={navClass}>광고비</NavLink>
              <NavLink to="/admin/messages" className={navClass}>
                <span className="inline-flex items-center">
                  메시지
                  {unreadCount > 0 && (
                    <>
                      <span className="ml-0.5 sm:ml-1 text-red-600 font-medium text-[clamp(0.55rem,1.2vw,0.75rem)] whitespace-nowrap">새 메시지</span>
                      <span className="ml-0.5 sm:ml-1 px-1 sm:px-1.5 py-0.5 rounded-full bg-red-500 text-white font-medium text-[clamp(0.55rem,1.2vw,0.75rem)]">
                        {unreadCount}
                      </span>
                    </>
                  )}
                </span>
              </NavLink>
            </nav>
          </div>
          <button
            onClick={handleLogout}
            className="text-[clamp(0.65rem,1.5vw,0.875rem)] text-gray-600 hover:text-gray-900 whitespace-nowrap shrink-0"
          >
            로그아웃
          </button>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
