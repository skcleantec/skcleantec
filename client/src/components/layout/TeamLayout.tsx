import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { Outlet, useNavigate, NavLink } from 'react-router-dom';
import { getToken, clearToken } from '../../stores/auth';
import { clearTeamToken, getTeamToken, subscribeTeamAuth } from '../../stores/teamAuth';
import { getMe, isAuthSessionExpiredError } from '../../api/auth';
import { getTeamNavBadges } from '../../api/team';
import { useVisibilityInterval } from '../../hooks/useVisibilityInterval';
import { useInboxRealtime } from '../../hooks/useInboxRealtime';

export function TeamLayout() {
  const teamToken = useSyncExternalStore(subscribeTeamAuth, getTeamToken, () => null);
  const navigate = useNavigate();
  const [userName, setUserName] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [csPendingCount, setCsPendingCount] = useState(0);

  useEffect(() => {
    const token = getTeamToken();
    if (!token) {
      setUserName(null);
      setUserRole(null);
      return;
    }
    getMe(token)
      .then((u: { name?: string; role?: string }) => {
        setUserName(u.name ?? null);
        setUserRole(u.role ?? null);
      })
      .catch((e) => {
        setUserName(null);
        setUserRole(null);
        if (isAuthSessionExpiredError(e)) {
          clearTeamToken();
          navigate('/login', { replace: true, state: { sessionExpired: true } });
        }
      });
  }, [teamToken, navigate]);

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
    `flex flex-1 min-h-[44px] min-w-0 flex-row flex-nowrap items-center justify-center gap-0 py-2 px-0.5 text-center text-[11px] font-medium leading-tight touch-manipulation ${
      isActive ? 'text-blue-600 bg-blue-50' : 'text-gray-600'
    }`;

  const hideTeamDayoffs = userRole === 'EXTERNAL_PARTNER';

  return (
    <div className="min-h-0 h-dvh max-h-dvh bg-gray-50 flex flex-col overflow-hidden">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 pt-[env(safe-area-inset-top)]">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <h1 className="text-lg font-semibold text-gray-800 shrink-0">SK클린텍</h1>
            <nav className="hidden sm:flex flex-wrap items-center gap-1">
              <NavLink to="/team/dashboard" className={navClass}>
                대시보드
              </NavLink>
              <NavLink to="/team/assignments" className={navClass}>
                배정목록
              </NavLink>
              <NavLink to="/team/schedule" className={navClass}>
                스케줄
              </NavLink>
              {!hideTeamDayoffs && (
                <NavLink to="/team/dayoffs" className={navClass}>
                  휴무일
                </NavLink>
              )}
              <div className="inline-flex shrink-0 flex-nowrap items-center gap-0">
                <NavLink
                  to="/team/cs"
                  className={navClass}
                  aria-label={csPendingCount > 0 ? `C/S, 미확인 ${csPendingCount}건` : 'C/S'}
                >
                  C/S
                </NavLink>
                {csPendingCount > 0 ? (
                  <span
                    className="-ml-3 inline-flex min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-center text-xs font-medium leading-none text-white tabular-nums motion-safe:animate-pulse motion-reduce:animate-none"
                    aria-hidden
                  >
                    {csPendingCount}
                  </span>
                ) : null}
              </div>
              <div className="inline-flex shrink-0 flex-nowrap items-center gap-0">
                <NavLink
                  to="/team/messages"
                  className={navClass}
                  aria-label={unreadCount > 0 ? `메시지, 새 메시지 ${unreadCount}건` : '메시지'}
                >
                  메시지
                </NavLink>
                {unreadCount > 0 ? (
                  <span
                    className="-ml-3 inline-flex min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-center text-xs font-medium leading-none text-white tabular-nums motion-safe:animate-pulse motion-reduce:animate-none"
                    aria-hidden
                  >
                    {unreadCount}
                  </span>
                ) : null}
              </div>
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
          <NavLink to="/team/assignments" className={mobileTabClass}>
            배정
          </NavLink>
          <NavLink to="/team/schedule" className={mobileTabClass}>
            스케줄
          </NavLink>
          {!hideTeamDayoffs && (
            <NavLink to="/team/dayoffs" className={mobileTabClass}>
              휴무일
            </NavLink>
          )}
          <NavLink
            to="/team/cs"
            className={mobileTabClass}
            aria-label={csPendingCount > 0 ? `C/S, 미확인 ${csPendingCount}건` : 'C/S'}
          >
            <span className="shrink-0">C/S</span>
            {csPendingCount > 0 ? (
              <span
                className="-ml-1 inline-flex min-w-[1rem] shrink-0 items-center justify-center rounded-full bg-red-500 px-1 py-0.5 text-center text-[10px] font-medium leading-none text-white tabular-nums motion-safe:animate-pulse motion-reduce:animate-none"
                aria-hidden
              >
                {csPendingCount}
              </span>
            ) : null}
          </NavLink>
          <NavLink
            to="/team/messages"
            className={mobileTabClass}
            aria-label={unreadCount > 0 ? `메시지, 새 메시지 ${unreadCount}건` : '메시지'}
          >
            <span className="shrink-0">메시지</span>
            {unreadCount > 0 ? (
              <span
                className="-ml-1 inline-flex min-w-[1rem] shrink-0 items-center justify-center rounded-full bg-red-500 px-1 py-0.5 text-center text-[10px] font-medium leading-none text-white tabular-nums motion-safe:animate-pulse motion-reduce:animate-none"
                aria-hidden
              >
                {unreadCount}
              </span>
            ) : null}
          </NavLink>
        </nav>
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-4 sm:py-6 min-w-0 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch] flex flex-col min-h-0">
        <Outlet />
      </main>
    </div>
  );
}
