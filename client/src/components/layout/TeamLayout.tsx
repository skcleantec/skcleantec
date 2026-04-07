import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { Outlet, useNavigate, NavLink } from 'react-router-dom';
import { getToken, clearToken } from '../../stores/auth';
import { clearTeamToken, getTeamToken, subscribeTeamAuth } from '../../stores/teamAuth';
import { getMe } from '../../api/auth';
import { getTeamNavBadges } from '../../api/team';
import { useVisibilityInterval } from '../../hooks/useVisibilityInterval';
import { useInboxRealtime } from '../../hooks/useInboxRealtime';

export function TeamLayout() {
  const teamToken = useSyncExternalStore(subscribeTeamAuth, getTeamToken, () => null);
  const navigate = useNavigate();
  const [userName, setUserName] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [csPendingCount, setCsPendingCount] = useState(0);

  useEffect(() => {
    const token = getTeamToken();
    if (!token) return;
    getMe(token)
      .then((u) => setUserName(u.name))
      .catch(() => setUserName(null));
  }, []);

  const fetchTeamBadges = useCallback(() => {
    const token = getTeamToken();
    if (!token) return;
    getTeamNavBadges(token)
      .then((r) => {
        setUnreadCount(r.unreadCount);
        setCsPendingCount(r.csPendingCount);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const token = getTeamToken();
    if (!token) return;
    (window as { __refreshUnreadCount?: () => void }).__refreshUnreadCount = fetchTeamBadges;
    (window as { __refreshCsPendingCount?: () => void }).__refreshCsPendingCount = fetchTeamBadges;
    return () => {
      delete (window as { __refreshUnreadCount?: () => void }).__refreshUnreadCount;
      delete (window as { __refreshCsPendingCount?: () => void }).__refreshCsPendingCount;
    };
  }, [fetchTeamBadges]);

  const { connected: navWsConnected } = useInboxRealtime(teamToken, fetchTeamBadges, Boolean(teamToken));
  useVisibilityInterval(fetchTeamBadges, navWsConnected ? 0 : 15000);

  const handleLogout = () => {
    const a = getToken();
    const t = getTeamToken();
    const sameDual = Boolean(a && t && a === t);
    clearTeamToken();
    if (sameDual) {
      clearToken();
    }
    navigate('/login');
  };

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 text-sm font-medium rounded ${isActive ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:text-gray-900'}`;

  const mobileTabClass = ({ isActive }: { isActive: boolean }) =>
    `flex-1 min-h-[44px] min-w-0 py-2 px-0.5 text-center text-[11px] font-medium leading-tight touch-manipulation flex flex-col items-center justify-center gap-0.5 ${
      isActive ? 'text-blue-600 bg-blue-50' : 'text-gray-600'
    }`;

  return (
    <div className="min-h-0 h-dvh max-h-dvh bg-gray-50 flex flex-col overflow-hidden">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 pt-[env(safe-area-inset-top)]">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <h1 className="text-lg font-semibold text-gray-800 shrink-0">SK클린텍</h1>
            <nav className="hidden sm:flex flex-wrap gap-1">
              <NavLink to="/team/dashboard" className={navClass}>대시보드</NavLink>
              <NavLink to="/team/schedule" className={navClass}>스케줄</NavLink>
              <NavLink to="/team/dayoffs" className={navClass}>휴무일</NavLink>
              <NavLink to="/team/cs" className={navClass}>
                C/S
                {csPendingCount > 0 && (
                  <>
                    <span className="ml-1 text-red-600 text-xs font-medium">미확인</span>
                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-500 text-white text-xs font-medium">
                      {csPendingCount}
                    </span>
                  </>
                )}
              </NavLink>
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
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
            {userName && (
              <span className="text-sm text-gray-600 truncate max-w-[5rem] sm:max-w-none">{userName}</span>
            )}
            <button
              onClick={handleLogout}
              className="text-sm text-gray-600 hover:text-gray-900 py-2 px-1 shrink-0"
            >
              로그아웃
            </button>
          </div>
        </div>
        {/* 모바일: 상단(헤더 바로 아래) 탭 메뉴 */}
        <nav className="flex sm:hidden border-t border-gray-100 bg-white">
          <NavLink to="/team/dashboard" className={mobileTabClass}>
            대시보드
          </NavLink>
          <NavLink to="/team/schedule" className={mobileTabClass}>
            스케줄
          </NavLink>
          <NavLink to="/team/dayoffs" className={mobileTabClass}>
            휴무일
          </NavLink>
          <NavLink to="/team/cs" className={mobileTabClass}>
            <span>C/S</span>
            {csPendingCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-medium">
                {csPendingCount}
              </span>
            )}
          </NavLink>
          <NavLink to="/team/messages" className={mobileTabClass}>
            <span>메시지</span>
            {unreadCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-medium">
                {unreadCount}
              </span>
            )}
          </NavLink>
        </nav>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-4 sm:py-6 min-w-0 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch] flex flex-col min-h-0">
        <Outlet />
      </main>
    </div>
  );
}
