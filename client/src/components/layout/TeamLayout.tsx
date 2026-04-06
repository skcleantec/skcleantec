import { useState, useEffect } from 'react';
import { Outlet, useNavigate, NavLink } from 'react-router-dom';
import { clearTeamToken, getTeamToken } from '../../stores/teamAuth';
import { getMe } from '../../api/auth';
import { getUnreadCount } from '../../api/messages';

export function TeamLayout() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const token = getTeamToken();
    if (!token) return;
    getMe(token)
      .then((u) => setUserName(u.name))
      .catch(() => setUserName(null));
  }, []);

  useEffect(() => {
    const token = getTeamToken();
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
    clearTeamToken();
    navigate('/login');
  };

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 text-sm font-medium rounded ${isActive ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:text-gray-900'}`;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col pb-16 sm:pb-0">
      <header className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <h1 className="text-lg font-semibold text-gray-800">SK클린텍</h1>
            <nav className="hidden sm:flex flex-wrap gap-1">
              <NavLink to="/team/dashboard" className={navClass}>대시보드</NavLink>
              <NavLink to="/team/schedule" className={navClass}>스케줄</NavLink>
              <NavLink to="/team/dayoffs" className={navClass}>휴무일</NavLink>
              <NavLink to="/team/messages" className={navClass}>
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
          <div className="flex items-center gap-3 shrink-0">
            {userName && (
              <span className="text-sm text-gray-600">{userName}</span>
            )}
            <button
              onClick={handleLogout}
              className="text-sm text-gray-600 hover:text-gray-900 py-2 px-1"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-4 sm:py-6 min-w-0 overflow-x-hidden">
        <Outlet />
      </main>
      {/* 모바일 하단 네비 */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex sm:hidden z-40 pb-[env(safe-area-inset-bottom)]">
        <NavLink
          to="/team/dashboard"
          className={({ isActive }) =>
            `flex-1 py-2.5 px-1 text-center text-[11px] sm:text-sm font-medium leading-tight ${isActive ? 'text-blue-600 bg-blue-50' : 'text-gray-600'}`
          }
        >
          대시보드
        </NavLink>
        <NavLink
          to="/team/schedule"
          className={({ isActive }) =>
            `flex-1 py-2.5 px-1 text-center text-[11px] sm:text-sm font-medium leading-tight ${isActive ? 'text-blue-600 bg-blue-50' : 'text-gray-600'}`
          }
        >
          스케줄
        </NavLink>
        <NavLink
          to="/team/dayoffs"
          className={({ isActive }) =>
            `flex-1 py-2.5 px-1 text-center text-[11px] sm:text-sm font-medium leading-tight ${isActive ? 'text-blue-600 bg-blue-50' : 'text-gray-600'}`
          }
        >
          휴무일
        </NavLink>
        <NavLink
          to="/team/messages"
          className={({ isActive }) =>
            `flex-1 py-2.5 px-1 text-center text-[11px] sm:text-sm font-medium flex flex-col items-center justify-center gap-0.5 min-w-0 ${isActive ? 'text-blue-600 bg-blue-50' : 'text-gray-600'}`
          }
        >
          <span>메시지</span>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-medium">
              {unreadCount}
            </span>
          )}
        </NavLink>
      </nav>
    </div>
  );
}
