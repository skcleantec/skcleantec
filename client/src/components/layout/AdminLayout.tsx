import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Outlet, useNavigate, NavLink, useLocation } from 'react-router-dom';
import { clearToken, getToken, subscribeAdminAuth } from '../../stores/auth';
import { clearTeamToken, getTeamToken, setTeamToken } from '../../stores/teamAuth';
import { getAdminNavBadges } from '../../api/adminNavBadges';
import { useVisibilityInterval } from '../../hooks/useVisibilityInterval';
import { useInboxRealtime, useInquiryCelebrateRealtime, type InquiryCelebratePayload } from '../../hooks/useInboxRealtime';
import { getMe, isAuthSessionExpiredError } from '../../api/auth';
import {
  ADMIN_NAV_DEF,
  type AdminNavId,
  canShowAdminNavItem,
  insertBefore,
  loadAdminNavOrder,
  saveAdminNavOrder,
} from '../../constants/adminNav';
import { CELEBRATE_BAR_TEST_EVENT } from '../../utils/adminCelebrateBarTest';
import { formatCelebrateBannerFromConfig } from '../../utils/adminCelebrateBarConfig';
import { UserProfileMenu } from '../common/UserProfileMenu';
import { AdminDevPreviewLinks } from '../admin/AdminDevPreviewLinks';

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

function CalendarCuteIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3.5" y="4.5" width="17" height="16" rx="3" />
      <path d="M7 3.5v3M17 3.5v3M3.5 9h17" />
      <circle cx="9" cy="12.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="9" cy="15.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="15.5" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15" cy="15.5" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** 모바일 관리자 FAB — 발주서(위) bottom ↔ 스케줄(아래) top 사이 = GAP 만큼 */
const ADMIN_MOBILE_FAB_PX = 40;
const ADMIN_MOBILE_FAB_GAP = 2;
/** 스케줄 버튼 top − 이 값 = 발주서 버튼 top (한 줄로 붙음) */
const ADMIN_MOBILE_FAB_ISSUE_TOP_OFFSET = ADMIN_MOBILE_FAB_PX + ADMIN_MOBILE_FAB_GAP;

/** 발주서 발급 FAB 아이콘 */
function OrderIssueFabIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.5 4.5h5.2L18.5 9.3V19a1.2 1.2 0 01-1.2 1.2H8.5A1.2 1.2 0 017.3 19V5.7A1.2 1.2 0 018.5 4.5z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.7 4.5v4.8h4.8" />
      <path strokeLinecap="round" d="M9.6 12.3h5.6M9.6 15.1h5.6" />
    </svg>
  );
}

export function AdminLayout() {
  const adminToken = useSyncExternalStore(subscribeAdminAuth, getToken, () => null);
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [csPendingCount, setCsPendingCount] = useState(0);
  const [showNavMoreLeft, setShowNavMoreLeft] = useState(false);
  const [showNavMoreRight, setShowNavMoreRight] = useState(false);
  const navScrollRef = useRef<HTMLDivElement>(null);
  const [meRole, setMeRole] = useState<string | null>(null);
  const [meName, setMeName] = useState<string | null>(null);
  const [mePhone, setMePhone] = useState<string | null>(null);
  const [meVehicleNumber, setMeVehicleNumber] = useState<string | null>(null);
  const [meProfileLoading, setMeProfileLoading] = useState(() => Boolean(adminToken));
  const [teamPreviewLink, setTeamPreviewLink] = useState(false);
  const [navOrder, setNavOrder] = useState<AdminNavId[]>(() => loadAdminNavOrder(false));
  const [draggingNavId, setDraggingNavId] = useState<AdminNavId | null>(null);
  const [fabTop, setFabTop] = useState<number | null>(null);
  const fabTopRef = useRef<number | null>(null);
  const [fabDragging, setFabDragging] = useState(false);
  const fabPointerIdRef = useRef<number | null>(null);
  const fabHoldTimerRef = useRef<number | null>(null);
  const fabDragOffsetRef = useRef({ y: 0 });
  const fabPressMovedRef = useRef(false);
  /** 길게 눌러 이동을 시작한 버튼 — 드래그 시 스케줄 top 계산·탭 시 이동 경로 */
  const fabPointerAnchorRef = useRef<'schedule' | 'issue' | null>(null);
  /** 드래그 중 closure 없이 “두 FAB 동시 표시” 여부 */
  const fabBothStackedRef = useRef(false);
  const fabStorageKey = 'admin_schedule_fab_pos_v1';
  const [celebration, setCelebration] = useState<InquiryCelebratePayload | null>(null);
  const [celebrationOpen, setCelebrationOpen] = useState(false);
  const celebAnimRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeCelebrateStrip = useCallback(() => {
    setCelebrationOpen(false);
    if (celebAnimRef.current) clearTimeout(celebAnimRef.current);
    celebAnimRef.current = setTimeout(() => setCelebration(null), 360);
  }, []);

  const openCelebrateStrip = useCallback((p: InquiryCelebratePayload) => {
    setCelebration(p);
    setCelebrationOpen(true);
    if (celebAnimRef.current) clearTimeout(celebAnimRef.current);
    celebAnimRef.current = null;
  }, []);

  useInquiryCelebrateRealtime(
    adminToken,
    openCelebrateStrip,
    Boolean(adminToken && (meRole === 'ADMIN' || meRole === 'MARKETER'))
  );

  useEffect(() => {
    if (meRole !== 'ADMIN' && meRole !== 'MARKETER') return;
    const onTestCelebrate = () => {
      openCelebrateStrip({
        type: 'inquiry:celebrate',
        registrarName: '\uD14C\uC2A4\uD2B8 \uB2F4\uB2F9',
        customerName: '\uD64D\uAE38\uB3D9',
        inquiryNumber: 'DEMO-001',
        source: '\uBC1C\uC8FC\uC11C',
      });
    };
    window.addEventListener(CELEBRATE_BAR_TEST_EVENT, onTestCelebrate);
    return () => window.removeEventListener(CELEBRATE_BAR_TEST_EVENT, onTestCelebrate);
  }, [meRole, openCelebrateStrip]);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setMeRole(null);
      setMeName(null);
      setMePhone(null);
      setMeVehicleNumber(null);
      setTeamPreviewLink(false);
      setMeProfileLoading(false);
      return;
    }
    setMeProfileLoading(true);
    let cancelled = false;
    getMe(token)
      .then((u: { role?: string; email?: string; name?: string; phone?: string | null; vehicleNumber?: string | null }) => {
        if (cancelled) return;
        const role = typeof u.role === 'string' ? u.role : null;
        setMeRole(role);
        setMeName(typeof u.name === 'string' && u.name.trim() ? u.name.trim() : null);
        setMePhone(typeof u.phone === 'string' && u.phone.trim() ? u.phone.trim() : null);
        setMeVehicleNumber(typeof u.vehicleNumber === 'string' && u.vehicleNumber.trim() ? u.vehicleNumber.trim() : null);
        const preview = role === 'ADMIN' || role === 'MARKETER';
        setTeamPreviewLink(preview);
        if (preview && !getTeamToken()) {
          setTeamToken(token);
        }
      })
      .catch((e) => {
        if (cancelled) return;
        if (isAuthSessionExpiredError(e)) {
          setMeRole(null);
          setMeName(null);
          setMePhone(null);
          setMeVehicleNumber(null);
          setTeamPreviewLink(false);
          clearToken();
          navigateRef.current('/login', { replace: true, state: { sessionExpired: true } });
          return;
        }
      })
      .finally(() => {
        if (!cancelled) setMeProfileLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [adminToken]);

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

  const teamLeadersActive =
    location.pathname === '/admin/team-leaders' ||
    location.pathname.startsWith('/admin/team-leaders/');

  const showScheduleFab =
    Boolean(fabTop != null) && !location.pathname.startsWith('/admin/schedule');
  const showOrderIssueFab =
    Boolean(fabTop != null) && !location.pathname.startsWith('/admin/inquiries/order-issue');
  const fabSafeRight = 'max(12px, env(safe-area-inset-right, 0px))';
  /** 발주서 FAB top — 스케줄과 같이 있을 때만 위로 스택 */
  const issueFabTopPx =
    fabTop == null
      ? undefined
      : showScheduleFab && showOrderIssueFab
        ? Math.max(8, fabTop - ADMIN_MOBILE_FAB_ISSUE_TOP_OFFSET)
        : fabTop;

  fabBothStackedRef.current = showScheduleFab && showOrderIssueFab;

  /** FAB는 항상 오른쪽 여백에 붙이고, 저장·드래그는 세로(스케줄 버튼 top)만 사용 */
  const clampFabTop = useCallback((scheduleTop: number) => {
    if (typeof window === 'undefined') return scheduleTop;
    const h = ADMIN_MOBILE_FAB_PX;
    const margin = 12;
    const maxY = Math.max(margin, window.innerHeight - h - margin - 16);
    return Math.min(maxY, Math.max(72, scheduleTop));
  }, []);

  useEffect(() => {
    fabTopRef.current = fabTop;
  }, [fabTop]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    /** 기본 위치: 화면 중하단보다 조금 위(엄지 영역·이중 FAB 여유) */
    const fallbackY = clampFabTop(Math.round(window.innerHeight * 0.46));
    try {
      const raw = window.localStorage.getItem(fabStorageKey);
      if (!raw) {
        setFabTop(fallbackY);
        fabTopRef.current = fallbackY;
        return;
      }
      const parsed = JSON.parse(raw) as { x?: number; y?: number };
      const y = typeof parsed?.y === 'number' ? parsed.y : undefined;
      const clamped = y != null ? clampFabTop(y) : fallbackY;
      setFabTop(clamped);
      fabTopRef.current = clamped;
    } catch {
      setFabTop(fallbackY);
      fabTopRef.current = fallbackY;
    }
  }, [clampFabTop]);

  useEffect(() => {
    const onResize = () => {
      setFabTop((prev) => {
        if (prev == null) return prev;
        const next = clampFabTop(prev);
        fabTopRef.current = next;
        return next;
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [clampFabTop]);

  const beginFabPointer = useCallback(
    (anchor: 'schedule' | 'issue', evt: ReactPointerEvent<HTMLButtonElement>) => {
      fabPointerAnchorRef.current = anchor;
      fabPressMovedRef.current = false;
      fabPointerIdRef.current = evt.pointerId;
      const rect = evt.currentTarget.getBoundingClientRect();
      fabDragOffsetRef.current = { y: evt.clientY - rect.top };
      if (fabHoldTimerRef.current != null) window.clearTimeout(fabHoldTimerRef.current);
      fabHoldTimerRef.current = window.setTimeout(() => setFabDragging(true), 420);
    },
    []
  );

  useEffect(() => {
    const onMove = (evt: PointerEvent) => {
      if (fabPointerIdRef.current == null || evt.pointerId !== fabPointerIdRef.current) return;
      if (fabDragging) {
        evt.preventDefault();
        const anchor = fabPointerAnchorRef.current;
        let nextScheduleTop: number;
        if (anchor === 'issue' && fabBothStackedRef.current) {
          const newIssueTop = evt.clientY - fabDragOffsetRef.current.y;
          nextScheduleTop = newIssueTop + ADMIN_MOBILE_FAB_ISSUE_TOP_OFFSET;
        } else {
          nextScheduleTop = evt.clientY - fabDragOffsetRef.current.y;
        }
        const next = clampFabTop(nextScheduleTop);
        fabTopRef.current = next;
        setFabTop(next);
        return;
      }
      const dx = Math.abs(evt.movementX);
      const dy = Math.abs(evt.movementY);
      if (dx + dy > 2) {
        fabPressMovedRef.current = true;
      }
    };
    const onUp = (evt: PointerEvent) => {
      if (fabPointerIdRef.current == null || evt.pointerId !== fabPointerIdRef.current) return;
      if (fabHoldTimerRef.current != null) {
        window.clearTimeout(fabHoldTimerRef.current);
        fabHoldTimerRef.current = null;
      }
      const wasDragging = fabDragging;
      const tapAnchor = fabPointerAnchorRef.current;
      fabPointerIdRef.current = null;
      fabPointerAnchorRef.current = null;
      setFabDragging(false);
      if (wasDragging) {
        const y = fabTopRef.current;
        if (y != null) {
          try {
            window.localStorage.setItem(fabStorageKey, JSON.stringify({ y }));
          } catch {}
        }
        return;
      }
      if (!fabPressMovedRef.current) {
        if (tapAnchor === 'issue') navigate('/admin/inquiries/order-issue');
        else navigate('/admin/schedule');
      }
    };
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [clampFabTop, fabDragging, navigate]);

  return (
    <div className="min-h-0 h-dvh max-h-dvh bg-gray-50 flex flex-col overflow-hidden">
      {celebration != null && (
        <div
          className="grid shrink-0 transition-[grid-template-rows] duration-300 ease-out"
          style={{ gridTemplateRows: celebrationOpen ? '1fr' : '0fr' }}
          aria-hidden={!celebrationOpen}
        >
          <div className="min-h-0 overflow-hidden">
            <div
              role="status"
              aria-live="polite"
              className="relative flex items-center justify-center px-8 py-2 sm:px-10 sm:py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-white border-b border-amber-700/30"
            >
              <p className="text-center text-xs sm:text-sm font-medium leading-snug max-w-4xl [text-wrap:pretty]">
                {formatCelebrateBannerFromConfig(celebration)}
              </p>
              <button
                type="button"
                aria-label={'닫기'}
                onClick={closeCelebrateStrip}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-white hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                  <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
      <header className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-6xl mx-auto flex flex-col gap-2 min-w-0">
          <div className="md:hidden flex items-center justify-between gap-2 min-w-0">
            <button
              type="button"
              onClick={() => navigate('/admin/dashboard')}
              className="min-w-0 truncate text-left text-base font-semibold text-gray-800 hover:text-gray-900"
              aria-label="대시보드로 이동"
              title="대시보드로 이동"
            >
              SK클린텍 솔루션
            </button>
            <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 shrink-0">
              {teamPreviewLink ? <AdminDevPreviewLinks adminToken={adminToken} /> : null}
              <UserProfileMenu
                token={adminToken}
                me={{ name: meName, phone: mePhone, vehicleNumber: meVehicleNumber, role: meRole }}
                loading={meProfileLoading}
                onSaved={(next) => {
                  setMeName(next.name);
                  setMePhone(next.phone);
                  setMeVehicleNumber(next.vehicleNumber);
                }}
                onLogout={handleLogout}
                onSessionExpired={() => {
                  clearToken();
                  clearTeamToken();
                  navigateRef.current('/login', { replace: true, state: { sessionExpired: true } });
                }}
              />
            </div>
          </div>
          <div className="flex flex-nowrap items-center justify-between gap-3 min-w-0">
          <div className="relative flex-1 min-w-0">
            <div
              ref={navScrollRef}
              onScroll={updateNavScrollHint}
              className="flex flex-nowrap items-center gap-1 sm:gap-2 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              <button
                type="button"
                onClick={() => navigate('/admin/dashboard')}
                className="hidden md:block text-[clamp(0.75rem,1.8vw,1.125rem)] font-semibold text-gray-800 whitespace-nowrap shrink-0 hover:text-gray-900"
                aria-label="대시보드로 이동"
                title="대시보드로 이동"
              >
                SK클린텍 솔루션
              </button>
              <nav className="flex flex-row flex-nowrap items-center gap-1 shrink-0">
                {navOrder.map((id) => {
                  const isAdmin = meRole === 'ADMIN';
                  if (id === 'dashboard') return null;
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
                  if (id === 'team-leaders') {
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
                          className={() => navClass({ isActive: teamLeadersActive })}
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
                        <div className="inline-flex shrink-0 flex-nowrap items-center gap-0">
                          <NavLink
                            to={def.to}
                            className={navClass}
                            aria-label={
                              unreadCount > 0 ? `${def.label}, 새 메시지 ${unreadCount}건` : def.label
                            }
                          >
                            {def.label}
                          </NavLink>
                          {unreadCount > 0 ? (
                            <span
                              className="-ml-2 inline-flex min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-center text-[clamp(0.55rem,1.2vw,0.75rem)] font-medium leading-none text-white tabular-nums motion-safe:animate-pulse motion-reduce:animate-none sm:-ml-3"
                              aria-hidden
                            >
                              {unreadCount}
                            </span>
                          ) : null}
                        </div>
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
                        <div className="inline-flex shrink-0 flex-nowrap items-center gap-0">
                          <NavLink
                            to={def.to}
                            className={navClass}
                            aria-label={
                              csPendingCount > 0 ? `${def.label}, 미확인 ${csPendingCount}건` : def.label
                            }
                          >
                            {def.label}
                          </NavLink>
                          {csPendingCount > 0 ? (
                            <span
                              className="-ml-2 inline-flex min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-center text-[clamp(0.55rem,1.2vw,0.75rem)] font-medium leading-none text-white tabular-nums motion-safe:animate-pulse motion-reduce:animate-none sm:-ml-3"
                              aria-hidden
                            >
                              {csPendingCount}
                            </span>
                          ) : null}
                        </div>
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
          <div className="hidden md:flex items-center gap-2 sm:gap-3 shrink-0">
            {teamPreviewLink ? <AdminDevPreviewLinks adminToken={adminToken} /> : null}
            <UserProfileMenu
              token={adminToken}
              me={{ name: meName, phone: mePhone, vehicleNumber: meVehicleNumber, role: meRole }}
              loading={meProfileLoading}
              onSaved={(next) => {
                setMeName(next.name);
                setMePhone(next.phone);
                setMeVehicleNumber(next.vehicleNumber);
              }}
              onLogout={handleLogout}
              onSessionExpired={() => {
                clearToken();
                clearTeamToken();
                navigateRef.current('/login', { replace: true, state: { sessionExpired: true } });
              }}
            />
          </div>
        </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6 min-w-0 w-full flex-1 flex flex-col min-h-0 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
        <Outlet />
      </main>
      {showOrderIssueFab && (
        <button
          type="button"
          aria-label="발주서 발급으로 이동"
          title={fabDragging ? '세로 위치 이동 중' : '발주서 발급 (길게 눌러 세로 위치만 이동)'}
          onPointerDown={(evt) => beginFabPointer('issue', evt)}
          className={`fixed z-[119] lg:hidden flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-amber-600/70 bg-amber-400 text-amber-950 shadow-[0_4px_14px_rgba(180,83,9,0.28),0_1px_4px_rgba(15,23,42,0.1)] ring-1 ring-inset ring-white/30 transition-[transform,box-shadow] active:scale-[0.94] active:shadow-sm ${
            fabDragging ? 'cursor-grabbing touch-none' : 'cursor-pointer'
          }`}
          style={{
            top: issueFabTopPx,
            right: fabSafeRight,
          }}
        >
          <OrderIssueFabIcon className="h-5 w-5" />
        </button>
      )}
      {showScheduleFab && (
        <button
          type="button"
          aria-label="스케줄 바로가기"
          title={fabDragging ? '세로 위치 이동 중' : '스케줄 바로가기 (길게 눌러 세로 위치만 이동)'}
          onPointerDown={(evt) => beginFabPointer('schedule', evt)}
          className={`fixed z-[120] lg:hidden flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-blue-600 to-blue-800 text-white shadow-[0_6px_18px_rgba(29,78,216,0.32),0_2px_8px_rgba(15,23,42,0.14)] ring-1 ring-inset ring-white/15 transition-[transform,box-shadow] active:scale-[0.94] active:shadow-[0_4px_14px_rgba(29,78,216,0.26),0_1px_4px_rgba(15,23,42,0.12)] ${
            fabDragging ? 'cursor-grabbing touch-none' : 'cursor-pointer'
          }`}
          style={{
            top: fabTop ?? undefined,
            right: fabSafeRight,
          }}
        >
          <CalendarCuteIcon className="h-5 w-5 drop-shadow-sm" />
        </button>
      )}
    </div>
  );
}
