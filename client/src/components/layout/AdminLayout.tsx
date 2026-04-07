import { useState, useEffect, useRef, useCallback, useSyncExternalStore } from 'react';
import { Outlet, useNavigate, NavLink, useLocation } from 'react-router-dom';
import { clearToken, getToken, subscribeAdminAuth } from '../../stores/auth';
import { clearTeamToken, getTeamToken, setTeamToken } from '../../stores/teamAuth';
import { isTeamPreviewAdminEmail } from '../../utils/teamPreview';
import { getAdminNavBadges } from '../../api/adminNavBadges';
import { useVisibilityInterval } from '../../hooks/useVisibilityInterval';
import { useInboxRealtime } from '../../hooks/useInboxRealtime';
import { getMe } from '../../api/auth';
import {
  ADMIN_NAV_DEF,
  type AdminNavId,
  canShowAdminNavItem,
  insertBefore,
  loadAdminNavOrder,
  saveAdminNavOrder,
} from '../../constants/adminNav';

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
  const adminToken = useSyncExternalStore(subscribeAdminAuth, getToken, () => null);
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [csPendingCount, setCsPendingCount] = useState(0);
  const [showNavMoreLeft, setShowNavMoreLeft] = useState(false);
  const [showNavMoreRight, setShowNavMoreRight] = useState(false);
  const navScrollRef = useRef<HTMLDivElement>(null);
  const [meRole, setMeRole] = useState<string | null>(null);
  const [teamPreviewLink, setTeamPreviewLink] = useState(false);
  const [navOrder, setNavOrder] = useState<AdminNavId[]>(() => loadAdminNavOrder(false));
  const [draggingNavId, setDraggingNavId] = useState<AdminNavId | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setMeRole(null);
      setTeamPreviewLink(false);
      return;
    }
    getMe(token)
      .then((u: { role?: string; email?: string }) => {
        setMeRole(typeof u.role === 'string' ? u.role : null);
        const preview = Boolean(u.email && isTeamPreviewAdminEmail(u.email));
        setTeamPreviewLink(preview);
        if (preview && !getTeamToken()) {
          setTeamToken(token);
        }
      })
      .catch(() => {
        setMeRole(null);
        setTeamPreviewLink(false);
      });
  }, []);

  useEffect(() => {
    if (!meRole) return;
    setNavOrder(loadAdminNavOrder(meRole === 'ADMIN'));
  }, [meRole]);

  const handleNavDragStart = (e: React.DragEvent, id: AdminNavId) => {
    setDraggingNavId(id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleNavDragEnd = () => {
    setDraggingNavId(null);
  };

  const handleNavDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleNavDrop = (e: React.DragEvent, targetId: AdminNavId) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData('text/plain');
    if (!raw || !(raw in ADMIN_NAV_DEF)) return;
    const dragId = raw as AdminNavId;
    if (dragId === targetId) return;
    const isAdmin = meRole === 'ADMIN';
    if (!canShowAdminNavItem(dragId, isAdmin) || !canShowAdminNavItem(targetId, isAdmin)) return;
    setNavOrder((prev) => {
      const next = insertBefore(prev, dragId, targetId);
      saveAdminNavOrder(isAdmin, next);
      return next;
    });
    setDraggingNavId(null);
  };

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

  const fetchNavBadges = useCallback(() => {
    const token = getToken();
    if (!token) return;
    getAdminNavBadges(token)
      .then((r) => {
        setUnreadCount(r.unreadCount);
        setCsPendingCount(r.csPendingCount);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    (window as { __refreshUnreadCount?: () => void }).__refreshUnreadCount = fetchNavBadges;
    (window as { __refreshCsPendingCount?: () => void }).__refreshCsPendingCount = fetchNavBadges;
    return () => {
      delete (window as { __refreshUnreadCount?: () => void }).__refreshUnreadCount;
      delete (window as { __refreshCsPendingCount?: () => void }).__refreshCsPendingCount;
    };
  }, [fetchNavBadges]);

  const { connected: navWsConnected } = useInboxRealtime(adminToken, fetchNavBadges, Boolean(adminToken));
  /** 웹소켓 연결 시 폴링 끔, 끊기면 15초 폴백 */
  useVisibilityInterval(fetchNavBadges, navWsConnected ? 0 : 15000);

  useEffect(() => {
    queueMicrotask(() => updateNavScrollHint());
  }, [location.pathname, unreadCount, csPendingCount, updateNavScrollHint]);

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
    clearTeamToken();
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
    <div className="min-h-0 h-dvh max-h-dvh bg-gray-50 flex flex-col overflow-hidden">
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
                {navOrder.map((id) => {
                  const isAdmin = meRole === 'ADMIN';
                  if (!canShowAdminNavItem(id, isAdmin)) return null;
                  const def = ADMIN_NAV_DEF[id];
                  const dragging = draggingNavId === id;
                  const dragHandle = (
                    <span
                      draggable
                      aria-label={`${def.label} 메뉴 순서 바꾸기`}
                      title="드래그하여 순서 변경"
                      onDragStart={(e) => {
                        e.stopPropagation();
                        handleNavDragStart(e, id);
                      }}
                      onDragEnd={handleNavDragEnd}
                      className="inline-grid grid-cols-2 gap-px px-0.5 py-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing select-none touch-none shrink-0"
                    >
                      {Array.from({ length: 6 }).map((_, i) => (
                        <span key={i} className="w-[3px] h-[3px] rounded-full bg-current" aria-hidden />
                      ))}
                    </span>
                  );
                  const rowClass = `inline-flex flex-nowrap items-center gap-0.5 rounded shrink-0 ${
                    dragging ? 'opacity-50' : ''
                  }`;
                  if (id === 'teams') {
                    return (
                      <div
                        key={id}
                        className={rowClass}
                        onDragOver={handleNavDragOver}
                        onDrop={(e) => handleNavDrop(e, id)}
                      >
                        {dragHandle}
                        <NavLink
                          to={def.to}
                          className={() => navClass({ isActive: teamMgmtActive })}
                        >
                          {def.label}
                        </NavLink>
                      </div>
                    );
                  }
                  if (id === 'messages') {
                    return (
                      <div
                        key={id}
                        className={rowClass}
                        onDragOver={handleNavDragOver}
                        onDrop={(e) => handleNavDrop(e, id)}
                      >
                        {dragHandle}
                        <NavLink to={def.to} className={navClass}>
                          <span className="inline-flex items-center">
                            {def.label}
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
                      </div>
                    );
                  }
                  if (id === 'cs') {
                    return (
                      <div
                        key={id}
                        className={rowClass}
                        onDragOver={handleNavDragOver}
                        onDrop={(e) => handleNavDrop(e, id)}
                      >
                        {dragHandle}
                        <NavLink to={def.to} className={navClass}>
                          <span className="inline-flex items-center">
                            {def.label}
                            {csPendingCount > 0 && (
                              <>
                                <span className="ml-0.5 sm:ml-1 text-red-600 font-medium text-[clamp(0.55rem,1.2vw,0.75rem)] whitespace-nowrap">
                                  미확인
                                </span>
                                <span className="ml-0.5 sm:ml-1 px-1 sm:px-1.5 py-0.5 rounded-full bg-red-500 text-white font-medium text-[clamp(0.55rem,1.2vw,0.75rem)]">
                                  {csPendingCount}
                                </span>
                              </>
                            )}
                          </span>
                        </NavLink>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={id}
                      className={rowClass}
                      onDragOver={handleNavDragOver}
                      onDrop={(e) => handleNavDrop(e, id)}
                    >
                      {dragHandle}
                      <NavLink to={def.to} className={navClass}>
                        {def.label}
                      </NavLink>
                    </div>
                  );
                })}
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
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {teamPreviewLink && (
              <NavLink
                to="/team/dashboard"
                className="text-[clamp(0.65rem,1.5vw,0.875rem)] text-blue-600 hover:text-blue-800 whitespace-nowrap py-2"
              >
                팀장 화면
              </NavLink>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="text-[clamp(0.65rem,1.5vw,0.875rem)] text-gray-600 hover:text-gray-900 whitespace-nowrap py-2"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6 min-w-0 w-full flex-1 flex flex-col min-h-0 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
        <Outlet />
      </main>
    </div>
  );
}
