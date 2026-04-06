import { useState, useEffect, useRef, useCallback } from 'react';
import { Outlet, useNavigate, NavLink, useLocation } from 'react-router-dom';
import { clearToken, getToken } from '../../stores/auth';
import { getUnreadCount } from '../../api/messages';
import { getMe } from '../../api/auth';

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNavMoreLeft, setShowNavMoreLeft] = useState(false);
  const [showNavMoreRight, setShowNavMoreRight] = useState(false);
  const navScrollRef = useRef<HTMLDivElement>(null);
  const isMessagesPage = location.pathname.includes('/messages');
  const [meRole, setMeRole] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setMeRole(null);
      return;
    }
    getMe(token)
      .then((u: { role?: string }) => setMeRole(typeof u.role === 'string' ? u.role : null))
      .catch(() => setMeRole(null));
  }, []);

  const updateNavScrollHint = useCallback(() => {
    const el = navScrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const hasOverflow = scrollWidth > clientWidth + 2;
    const atStart = scrollLeft <= 3;
    const atEnd = scrollLeft + clientWidth >= scrollWidth - 3;
    setShowNavMoreLeft(hasOverflow && !atStart);
    setShowNavMoreRight(hasOverflow && !atEnd);
  }, []);

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

  useEffect(() => {
    queueMicrotask(() => updateNavScrollHint());
  }, [location.pathname, unreadCount, updateNavScrollHint]);

  useEffect(() => {
    const el = navScrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => updateNavScrollHint());
    ro.observe(el);
    window.addEventListener('resize', updateNavScrollHint);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateNavScrollHint);
    };
  }, [updateNavScrollHint]);

  const handleLogout = () => {
    clearToken();
    navigate('/login');
  };

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `inline-flex items-center px-2 sm:px-3 py-2 text-[clamp(0.6rem,1.4vw,0.875rem)] font-medium rounded whitespace-nowrap shrink-0 flex-none break-keep ${isActive ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:text-gray-900'}`;

  const scrollStep = () => {
    const el = navScrollRef.current;
    if (!el) return Math.min(160, 160);
    return Math.min(160, Math.max(80, Math.round(el.clientWidth * 0.45)));
  };

  const scrollNavLeft = () => {
    navScrollRef.current?.scrollBy({ left: -scrollStep(), behavior: 'smooth' });
  };

  const scrollNavRight = () => {
    navScrollRef.current?.scrollBy({ left: scrollStep(), behavior: 'smooth' });
  };

  const teamMgmtActive =
    location.pathname === '/admin/teams' || location.pathname.startsWith('/admin/teams/');

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-6xl mx-auto flex flex-nowrap items-center justify-between gap-3 min-w-0">
          <div className="relative flex-1 min-w-0">
            <div
              ref={navScrollRef}
              onScroll={updateNavScrollHint}
              className="flex flex-nowrap items-center gap-1 sm:gap-2 overflow-x-auto overflow-y-hidden overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              <h1 className="text-[clamp(0.75rem,1.8vw,1.125rem)] font-semibold text-gray-800 whitespace-nowrap shrink-0">
                SK클린텍 관리자
              </h1>
              <nav className="flex flex-row flex-nowrap items-center gap-1 shrink-0">
                <NavLink to="/admin/dashboard" className={navClass}>
                  대시보드
                </NavLink>
                <NavLink to="/admin/inquiries" className={navClass}>
                  접수 목록
                </NavLink>
                <NavLink to="/admin/schedule" className={navClass}>
                  스케줄 표
                </NavLink>
                {meRole === 'ADMIN' && (
                  <>
                    <NavLink to="/admin/team-leaders" className={navClass}>
                      사용자관리
                    </NavLink>
                    <NavLink to="/admin/teams" className={() => navClass({ isActive: teamMgmtActive })}>
                      팀 관리
                    </NavLink>
                  </>
                )}
                <NavLink to="/admin/orderforms" className={navClass}>
                  발주서
                </NavLink>
                <NavLink to="/admin/cs" className={navClass}>
                  C/S 관리
                </NavLink>
                <NavLink to="/admin/advertising" className={navClass}>
                  광고비
                </NavLink>
                <NavLink to="/admin/messages" className={navClass}>
                  <span className="inline-flex items-center">
                    메시지
                    {unreadCount > 0 && (
                      <>
                        <span className="ml-0.5 sm:ml-1 text-red-600 font-medium text-[clamp(0.55rem,1.2vw,0.75rem)] whitespace-nowrap">
                          새 메시지
                        </span>
                        <span className="ml-0.5 sm:ml-1 px-1 sm:px-1.5 py-0.5 rounded-full bg-red-500 text-white font-medium text-[clamp(0.55rem,1.2vw,0.75rem)]">
                          {unreadCount}
                        </span>
                      </>
                    )}
                  </span>
                </NavLink>
              </nav>
            </div>
            {showNavMoreLeft && (
              <div className="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center justify-start lg:hidden">
                <div className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-white via-white/95 to-transparent" aria-hidden />
                <button
                  type="button"
                  onClick={scrollNavLeft}
                  className="pointer-events-auto relative ml-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm active:bg-gray-50"
                  aria-label="메뉴가 왼쪽으로 더 있습니다. 탭하면 스크롤됩니다."
                >
                  <ChevronLeftIcon className="h-5 w-5" />
                </button>
              </div>
            )}
            {showNavMoreRight && (
              <div className="pointer-events-none absolute inset-y-0 right-0 z-10 flex items-center justify-end lg:hidden">
                <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-white via-white/95 to-transparent" aria-hidden />
                <button
                  type="button"
                  onClick={scrollNavRight}
                  className="pointer-events-auto relative mr-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 shadow-sm active:bg-gray-50"
                  aria-label="메뉴가 오른쪽으로 더 있습니다. 탭하면 스크롤됩니다."
                >
                  <ChevronRightIcon className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="text-[clamp(0.65rem,1.5vw,0.875rem)] text-gray-600 hover:text-gray-900 whitespace-nowrap shrink-0 py-2"
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
