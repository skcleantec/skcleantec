import { useState, useEffect } from 'react';
import { Outlet, useNavigate, NavLink } from 'react-router-dom';
import { clearToken, getToken } from '../../stores/auth';
import { getUnreadCount } from '../../api/messages';

export function AdminLayout() {
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const fetch = () => {
      getUnreadCount(token).then((r) => setUnreadCount(r.count)).catch(() => {});
    };
    fetch();
    (window as { __refreshUnreadCount?: () => void }).__refreshUnreadCount = fetch;
    const id = setInterval(fetch, 15000);
    return () => {
      delete (window as { __refreshUnreadCount?: () => void }).__refreshUnreadCount;
      clearInterval(id);
    };
  }, []);

  const handleLogout = () => {
    clearToken();
    navigate('/admin/login');
  };

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 text-sm font-medium rounded ${isActive ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:text-gray-900'}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0 overflow-x-auto">
            <h1 className="text-lg font-semibold text-gray-800">SK클린텍 관리자</h1>
            <nav className="flex gap-1">
              <NavLink to="/admin/dashboard" className={navClass}>대시보드</NavLink>
              <NavLink to="/admin/inquiries" className={navClass}>접수 목록</NavLink>
              <NavLink to="/admin/schedule" className={navClass}>스케줄 표</NavLink>
              <NavLink to="/admin/team-leaders" className={navClass}>팀장 관리</NavLink>
              <NavLink to="/admin/orderforms" className={navClass}>발주서</NavLink>
              <NavLink to="/admin/messages" className={navClass}>
                메시지
                {unreadCount > 0 && (
                  <>
                    <span className="ml-1 text-red-600 text-xs font-medium">새 메시지</span>
                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-500 text-white text-xs font-medium">
                      {unreadCount}
                    </span>
                  </>
                )}
              </NavLink>
            </nav>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            로그아웃
          </button>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6 min-w-0 overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
