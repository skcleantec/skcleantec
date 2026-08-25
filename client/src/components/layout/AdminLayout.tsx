import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  useSyncExternalStore,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { Outlet, useNavigate, NavLink, Link, useLocation } from 'react-router-dom';
import { clearToken, getToken, subscribeAdminAuth } from '../../stores/auth';
import { clearTeamToken, getTeamToken, setTeamToken } from '../../stores/teamAuth';
import { getAdminNavBadges } from '../../api/adminNavBadges';
import { notifyInquiriesSubNavBadgesRefresh } from '../../utils/adminInquiriesNavBadges';
import { useVisibilityInterval } from '../../hooks/useVisibilityInterval';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { type StaffAdminMeFields } from '../../utils/staffAdminAccess';
import { useDebouncedCallback } from '../../utils/debounceCallback';
import {
  adminNavPrefetchHandlers,
  prefetchAdminNavPage,
  prefetchTeamLeadersSettlementPages,
} from '../../utils/prefetchAdminPages';
import { runWhenIdle } from '../../utils/deferWhenIdle';
import { useStaffAppPushNavigation } from '../../hooks/useStaffAppPushNavigation';
import { useStaffAppNativePushRegister } from '../../hooks/useStaffAppNativePushRegister';
import { isCbiseoStaffNativeApp } from '../../utils/cbiseoNativeApp';
import { assignStaffHomePath, isStandalonePwa } from '../../utils/pwaStandalone';
import {
  useInboxRealtime,
  useInquiryCelebrateRealtime,
  useReviewPaybackRealtime,
  useLandingContactRealtime,
  useDbMarketplaceHandoffConfirmedRealtime,
  type InquiryCelebratePayload,
  type LandingContactRtPayload,
  type DbMarketplaceHandoffConfirmedRtPayload,
} from '../../hooks/useInboxRealtime';
import { getMe, isAuthSessionExpiredError, isAuthBillingAccessBlockedError } from '../../api/auth';
import {
  hydrateAdminSessionFromAuthMe,
  readInitialAdminSession,
} from '../../utils/adminAuthMeHydration';
import { bootstrapAuthMeFromLocal } from '../../api/authMeSnapshot';
import {
  ADMIN_NAV_DEF,
  type AdminNavId,
  canShowAdminNavItem,
  insertBefore,
  loadAdminNavOrder,
  saveAdminNavOrder,
} from '../../constants/adminNav';
import { CELEBRATE_BAR_TEST_EVENT } from '../../utils/adminCelebrateBarTest';
import { TenantBrandLogo } from '../brand/TenantBrandLogo';
import { formatCelebrateBannerFromConfig } from '../../utils/adminCelebrateBarConfig';
import { UserProfileMenu } from '../common/UserProfileMenu';
import { AdminStagingDbImportModal } from '../admin/AdminStagingDbImportModal';
import { BillingDunningModal } from '../admin/BillingDunningModal';
import {
  ProfileOnboardingModal,
  type ProfileOnboardingInitial,
} from '../common/ProfileOnboardingModal';
import { ChangeLogBell } from '../admin/ChangeLogBell';
import { ScheduleAlertSiren } from '../admin/ScheduleAlertSiren';
import { getUnseenChangeCount, getChangeHistoryList, markChangeSeen } from '../../api/inquiryChangeLogs';
import { AdminDevPreviewLinks } from '../admin/AdminDevPreviewLinks';
import { AdminVolumeStatsButton } from '../admin/AdminVolumeStatsButton';
import { getScheduleDetailInquiryIdForOrderFab } from '../../utils/adminScheduleOrderFab';
import { TenantCapabilitiesProvider } from '../../hooks/useTenantCapabilities';
import type { TelecrmUserCapabilities } from '@shared/telecrmTenantPolicy';
import {
  AdminStaffSessionProvider,
} from '../../hooks/useAdminStaffSession';
import { hasFeature } from '@shared/tenantFeatureModules';
import { getDbMarketplaceNavCounts } from '../../api/dbMarketplace';
import { AdminStaffPathGate } from './AdminStaffPathGate';
import { DarkHeaderNavScroll } from './DarkHeaderNavScroll';
import { NavFavoritesProvider } from '../../hooks/useNavFavorites';
import { AdminMobileNavFavoritesAccess } from './AdminMobileNavFavoritesAccess';
import { AdminDesktopNavFavoritesAccess } from './AdminDesktopNavFavoritesAccess';
import {
  MOBILE_GNB_ITEM_BASE,
  MOBILE_GNB_ICON_CLASS,
  MOBILE_STAFF_DOCK_BTN_CLASS,
  MOBILE_STAFF_DOCK_BTN_PX,
  MOBILE_STAFF_DOCK_GAP_PX,
  MOBILE_STAFF_DOCK_ICON_CLASS,
} from './mobileStaffDockStyles';
import type { StaffDesktopDockDragHandlers } from './staffRightRailStyles';

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
const ADMIN_MOBILE_FAB_PX = MOBILE_STAFF_DOCK_BTN_PX;
const ADMIN_MOBILE_FAB_GAP = MOBILE_STAFF_DOCK_GAP_PX;
/** 스케줄 버튼 top − 이 값 = 발주서 버튼 top (한 줄로 붙음) */
const ADMIN_MOBILE_FAB_ISSUE_TOP_OFFSET = ADMIN_MOBILE_FAB_PX + ADMIN_MOBILE_FAB_GAP;
const ADMIN_MOBILE_FAB_HOLD_MS = 420;
const ADMIN_MOBILE_FAB_EARLY_DRAG_MS = 280;
const ADMIN_MOBILE_FAB_EARLY_DRAG_DY_PX = 6;
const ADMIN_MOBILE_FAB_HORIZONTAL_CANCEL_DX_PX = 14;

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

function AdminNavIcon({ id, className }: { id: string; className?: string }) {
  if (id === 'dashboard') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </svg>
    );
  }
  if (id === 'inquiries') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    );
  }
  if (id === 'schedule') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    );
  }
  if (id === 'team-leaders') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    );
  }
  if (id === 'advertising') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    );
  }
  if (id === 'messages') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
    );
  }
  if (id === 'db-marketplace') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="9" cy="20" r="1.5" fill="currentColor" stroke="none" />
        <circle cx="17" cy="20" r="1.5" fill="currentColor" stroke="none" />
        <path d="M3 4h2l2.5 11h9.5l2.2-7H7.5" />
      </svg>
    );
  }
  return null;
}

/** GNB 메뉴 — 아이콘·제목 가로 한 줄 (모바일 컴팩트 · lg+ 기존 크기) */
const ADMIN_GNB_ITEM_BASE = MOBILE_GNB_ITEM_BASE;

function adminGnbItemClass(isActive: boolean): string {
  return `${ADMIN_GNB_ITEM_BASE} ${
    isActive
      ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/20'
      : 'text-slate-300 hover:text-white hover:bg-white/10'
  }`;
}

function AdminGnbItemContent({ id, label }: { id: string; label: string }) {
  return (
    <>
      <AdminNavIcon id={id} className={MOBILE_GNB_ICON_CLASS} />
      <span className="whitespace-nowrap leading-none">{label}</span>
    </>
  );
}

export function AdminLayout() {
  const adminToken = useSyncExternalStore(subscribeAdminAuth, getToken, () => null);
  const [initialSession] = useState(readInitialAdminSession);
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  useEffect(() => {
    navigateRef.current = navigate;
  });
  const goAdminHomeWithRefresh = useCallback(() => {
    if (isStandalonePwa()) {
      assignStaffHomePath('/admin/dashboard');
      return;
    }
    navigate('/admin/dashboard');
  }, [navigate]);
  const openScheduleFromAlert = useCallback(
    (inquiryId: string, preferredDate: string | null) => {
      const params = new URLSearchParams();
      if (preferredDate) params.set('day', preferredDate);
      params.set('openInquiry', inquiryId);
      navigate(`/admin/schedule?${params.toString()}`);
    },
    [navigate],
  );
  const location = useLocation();
  useStaffAppPushNavigation(Boolean(adminToken));
  useEffect(() => {
    if (isCbiseoStaffNativeApp()) {
      document.documentElement.classList.add('cbiseo-staff-app');
    }
  }, []);
  useStaffAppNativePushRegister(adminToken);
  const [unreadCount, setUnreadCount] = useState(0);
  const [csPendingCount, setCsPendingCount] = useState(0);
  const [reviewPaybackUnseenCount, setReviewPaybackUnseenCount] = useState(0);
  const [leadsPendingCount, setLeadsPendingCount] = useState(0);
  const [marketplaceDraftCount, setMarketplaceDraftCount] = useState(0);
  const [marketplaceOpenCount, setMarketplaceOpenCount] = useState(0);
  const [marketplaceSellerPendingCount, setMarketplaceSellerPendingCount] = useState(0);
  const [marketplaceBuyerPendingCount, setMarketplaceBuyerPendingCount] = useState(0);
  const [reviewPaybackToast, setReviewPaybackToast] = useState<string | null>(null);
  const reviewPaybackToastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [meRole, setMeRole] = useState<string | null>(() => initialSession?.role ?? null);
  const [effectiveStaffAdmin, setEffectiveStaffAdmin] = useState(
    () => initialSession?.effectiveStaffAdmin ?? false,
  );
  const [staffMe, setStaffMe] = useState<StaffAdminMeFields | null>(() => initialSession?.staffMe ?? null);
  const [meUserId, setMeUserId] = useState<string | null>(() => initialSession?.meUserId ?? null);
  const [meName, setMeName] = useState<string | null>(() => initialSession?.meName ?? null);
  const [meEmail, setMeEmail] = useState<string | null>(() => initialSession?.meEmail ?? null);
  const [mePhone, setMePhone] = useState<string | null>(() => initialSession?.mePhone ?? null);
  const [meVehicleNumber, setMeVehicleNumber] = useState<string | null>(
    () => initialSession?.meVehicleNumber ?? null,
  );
  const [meProfileLoading, setMeProfileLoading] = useState(
    () => Boolean(adminToken) && !initialSession?.role,
  );
  const [teamPreviewLink, setTeamPreviewLink] = useState(() => initialSession?.teamPreviewLink ?? false);
  const [navOrder, setNavOrder] = useState<AdminNavId[]>(() => loadAdminNavOrder(false));
  const [draggingNavId, setDraggingNavId] = useState<AdminNavId | null>(null);
  const [fabTop, setFabTop] = useState<number | null>(null);
  const fabTopRef = useRef<number | null>(null);
  const [changelogRailMount, setChangelogRailMount] = useState<HTMLDivElement | null>(null);
  const [desktopDockDrag, setDesktopDockDrag] = useState<StaffDesktopDockDragHandlers | null>(null);
  const [showStagingDbImportMenu, setShowStagingDbImportMenu] = useState(
    () => initialSession?.showStagingDbImportMenu ?? false,
  );
  const [showVolumeStatsMenu, setShowVolumeStatsMenu] = useState(
    () => initialSession?.showVolumeStatsMenu ?? false,
  );
  const [isPlatformSupportAccess, setIsPlatformSupportAccess] = useState(
    () => initialSession?.isPlatformSupportAccess ?? false,
  );
  const [suppressCelebrateBar, setSuppressCelebrateBar] = useState(
    () => initialSession?.suppressCelebrateBar ?? false,
  );
  const [tenantFeatures, setTenantFeatures] = useState<readonly string[] | null>(
    () => initialSession?.tenantFeatures ?? null,
  );
  const [tenantTelecrm, setTenantTelecrm] = useState<TelecrmUserCapabilities | null>(
    () => initialSession?.tenantTelecrm ?? null,
  );
  const [tenantPlan, setTenantPlan] = useState<string | null>(() => initialSession?.tenantPlan ?? null);
  const [tenantSlug, setTenantSlug] = useState<string | null>(() => initialSession?.tenantSlug ?? null);
  const [tenantName, setTenantName] = useState<string | null>(() => initialSession?.tenantName ?? null);
  const [meTenantId, setMeTenantId] = useState<string | null>(() => initialSession?.meTenantId ?? null);
  const [isTenantOwner, setIsTenantOwner] = useState(() => initialSession?.isTenantOwner ?? false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(() => initialSession?.isSuperAdmin ?? false);
  const [canCrmSettings, setCanCrmSettings] = useState(() => initialSession?.canCrmSettings ?? false);
  useDocumentTitle(tenantName);
  const [stagingDbImportModalOpen, setStagingDbImportModalOpen] = useState(false);
  const [billingDunningOpen, setBillingDunningOpen] = useState(false);
  const [billingDunningAttemptKey, setBillingDunningAttemptKey] = useState(0);
  const closeBillingDunning = useCallback(() => setBillingDunningOpen(false), []);
  const [profileOnboardingRequired, setProfileOnboardingRequired] = useState(
    () => initialSession?.profileOnboardingRequired ?? false,
  );
  const [profileOnboardingInitial, setProfileOnboardingInitial] = useState<ProfileOnboardingInitial>(
    () => initialSession?.profileOnboardingInitial ?? { role: 'MARKETER' },
  );
  const [fabDragging, setFabDragging] = useState(false);
  const [fabPressActive, setFabPressActive] = useState(false);
  const fabDraggingRef = useRef(false);
  const fabPointerIdRef = useRef<number | null>(null);
  const fabHoldTimerRef = useRef<number | null>(null);
  const fabDragOffsetRef = useRef({ y: 0 });
  const fabPressMovedRef = useRef(false);
  const fabCaptureTargetRef = useRef<HTMLElement | null>(null);
  const endFabPressListenersRef = useRef<(() => void) | null>(null);
  const endFabDragListenersRef = useRef<(() => void) | null>(null);
  /** 길게 눌러 이동을 시작한 버튼 — 탭 시 이동·열기 경로 */
  const fabPointerAnchorRef = useRef<'schedule' | 'issue' | 'bell' | 'favorites' | null>(null);
  const openMobileFavoritesRef = useRef<(() => void) | null>(null);
  const fabStackRef = useRef<HTMLDivElement | null>(null);
  const [fabBellMount, setFabBellMount] = useState<HTMLDivElement | null>(null);
  const fabStackCountRef = useRef(1);
  const fabStorageKey = 'admin_schedule_fab_pos_v1';
  const [celebration, setCelebration] = useState<InquiryCelebratePayload | null>(null);
  const [celebrationOpen, setCelebrationOpen] = useState(false);
  const celebAnimRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [landingContactAlert, setLandingContactAlert] = useState<LandingContactRtPayload | null>(null);
  const [landingContactAlertOpen, setLandingContactAlertOpen] = useState(false);
  const landingContactAnimRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeCelebrateStrip = useCallback(() => {
    setCelebrationOpen(false);
    if (celebAnimRef.current) clearTimeout(celebAnimRef.current);
    celebAnimRef.current = setTimeout(() => setCelebration(null), 360);
  }, []);

  const openCelebrateInquiry = useCallback(
    (inquiryId: string) => {
      closeCelebrateStrip();
      navigate(`/admin/inquiries?openInquiry=${encodeURIComponent(inquiryId)}`);
    },
    [closeCelebrateStrip, navigate]
  );

  const openCelebrateStrip = useCallback((p: InquiryCelebratePayload) => {
    setCelebration(p);
    setCelebrationOpen(true);
    if (celebAnimRef.current) clearTimeout(celebAnimRef.current);
    celebAnimRef.current = null;
  }, []);

  const closeLandingContactStrip = useCallback(() => {
    setLandingContactAlertOpen(false);
    if (landingContactAnimRef.current) clearTimeout(landingContactAnimRef.current);
    landingContactAnimRef.current = setTimeout(() => setLandingContactAlert(null), 360);
  }, []);

  const openLandingContactStrip = useCallback(
    (p: LandingContactRtPayload) => {
      setLandingContactAlert(p);
      setLandingContactAlertOpen(true);
      if (landingContactAnimRef.current) clearTimeout(landingContactAnimRef.current);
      landingContactAnimRef.current = null;
    },
    [],
  );

  const openLandingContactLeads = useCallback(() => {
    closeLandingContactStrip();
    navigate('/admin/inquiries/leads');
  }, [closeLandingContactStrip, navigate]);

  const showMarketplaceHandoffStrip = Boolean(
    tenantFeatures && hasFeature(tenantFeatures, 'mod_db_marketplace') && marketplaceSellerPendingCount > 0,
  );
  const [marketplaceHandoffStripOpen, setMarketplaceHandoffStripOpen] = useState(false);
  const [marketplaceHandoffStripDismissedCount, setMarketplaceHandoffStripDismissedCount] = useState<
    number | null
  >(null);

  useEffect(() => {
    if (!showMarketplaceHandoffStrip) {
      setMarketplaceHandoffStripOpen(false);
      setMarketplaceHandoffStripDismissedCount(null);
      return;
    }
    if (marketplaceHandoffStripDismissedCount === marketplaceSellerPendingCount) {
      setMarketplaceHandoffStripOpen(false);
      return;
    }
    setMarketplaceHandoffStripOpen(true);
  }, [showMarketplaceHandoffStrip, marketplaceSellerPendingCount, marketplaceHandoffStripDismissedCount]);

  const closeMarketplaceHandoffStrip = useCallback(() => {
    setMarketplaceHandoffStripOpen(false);
    setMarketplaceHandoffStripDismissedCount(marketplaceSellerPendingCount);
  }, [marketplaceSellerPendingCount]);

  const openMarketplaceHandoffPending = useCallback(() => {
    navigate('/admin/db-marketplace?side=share&tab=pending');
  }, [navigate]);

  const [marketplaceHandoffConfirmedAlert, setMarketplaceHandoffConfirmedAlert] =
    useState<DbMarketplaceHandoffConfirmedRtPayload | null>(null);
  const [marketplaceHandoffConfirmedAlertOpen, setMarketplaceHandoffConfirmedAlertOpen] = useState(false);
  const marketplaceHandoffConfirmedAnimRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeMarketplaceHandoffConfirmedStrip = useCallback(() => {
    setMarketplaceHandoffConfirmedAlertOpen(false);
    if (marketplaceHandoffConfirmedAnimRef.current) clearTimeout(marketplaceHandoffConfirmedAnimRef.current);
    marketplaceHandoffConfirmedAnimRef.current = setTimeout(
      () => setMarketplaceHandoffConfirmedAlert(null),
      360,
    );
  }, []);

  const openMarketplaceHandoffConfirmedStrip = useCallback(
    (p: DbMarketplaceHandoffConfirmedRtPayload) => {
      setMarketplaceHandoffConfirmedAlert(p);
      setMarketplaceHandoffConfirmedAlertOpen(true);
      if (marketplaceHandoffConfirmedAnimRef.current) clearTimeout(marketplaceHandoffConfirmedAnimRef.current);
      marketplaceHandoffConfirmedAnimRef.current = null;
    },
    [],
  );

  const openMarketplaceHandoffConfirmedInquiry = useCallback(() => {
    const inquiryId = marketplaceHandoffConfirmedAlert?.targetInquiryId;
    closeMarketplaceHandoffConfirmedStrip();
    if (inquiryId) {
      navigate(`/admin/inquiries?openInquiry=${encodeURIComponent(inquiryId)}`);
      return;
    }
    navigate('/admin/db-marketplace?side=share&tab=pending');
  }, [closeMarketplaceHandoffConfirmedStrip, marketplaceHandoffConfirmedAlert, navigate]);

  useInquiryCelebrateRealtime(
    adminToken,
    openCelebrateStrip,
    Boolean(
      adminToken &&
        (meRole === 'ADMIN' || meRole === 'MARKETER') &&
        !suppressCelebrateBar,
    ),
    meTenantId,
  );

  useEffect(() => {
    if (suppressCelebrateBar) return;
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
  }, [meRole, openCelebrateStrip, suppressCelebrateBar]);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setMeRole(null);
      setStaffMe(null);
      setEffectiveStaffAdmin(false);
      setMeUserId(null);
      setMeName(null);
      setMeEmail(null);
      setMePhone(null);
      setMeVehicleNumber(null);
      setTeamPreviewLink(false);
      setShowStagingDbImportMenu(false);
      setIsPlatformSupportAccess(false);
      setSuppressCelebrateBar(false);
      setTenantFeatures(null);
      setTenantTelecrm(null);
      setTenantPlan(null);
      setTenantSlug(null);
      setTenantName(null);
      setMeTenantId(null);
      setIsTenantOwner(false);
      setIsSuperAdmin(false);
      setCanCrmSettings(false);
      setProfileOnboardingRequired(false);
      setMeProfileLoading(false);
      return;
    }
    const boot = bootstrapAuthMeFromLocal(token);
    if (!boot?.role) {
      setMeProfileLoading(true);
    }
    let cancelled = false;
    getMe(token)
      .then((u) => {
        if (cancelled) return;
        const h = hydrateAdminSessionFromAuthMe(u);
        setMeRole(h.role);
        setStaffMe(h.staffMe);
        setEffectiveStaffAdmin(h.effectiveStaffAdmin);
        setMeUserId(h.meUserId);
        setMeName(h.meName);
        setMeEmail(h.meEmail);
        setMePhone(h.mePhone);
        setMeVehicleNumber(h.meVehicleNumber);
        setShowStagingDbImportMenu(h.showStagingDbImportMenu);
        setShowVolumeStatsMenu(h.showVolumeStatsMenu);
        setIsPlatformSupportAccess(h.isPlatformSupportAccess);
        setSuppressCelebrateBar(h.suppressCelebrateBar);
        setTenantFeatures(h.tenantFeatures);
        setTenantTelecrm(h.tenantTelecrm);
        setTenantPlan(h.tenantPlan);
        setTenantSlug(h.tenantSlug);
        setTenantName(h.tenantName);
        setMeTenantId(h.meTenantId);
        setIsTenantOwner(h.isTenantOwner);
        setIsSuperAdmin(h.isSuperAdmin);
        setCanCrmSettings(h.canCrmSettings);
        setProfileOnboardingRequired(h.profileOnboardingRequired);
        setProfileOnboardingInitial(h.profileOnboardingInitial);
        setTeamPreviewLink(h.teamPreviewLink);
        if (h.teamPreviewLink && !getTeamToken()) {
          setTeamToken(token);
        }
        if (h.role === 'ADMIN' && h.meTenantId) {
          setBillingDunningOpen(true);
        } else {
          setBillingDunningOpen(false);
        }
      })
      .catch((e) => {
        if (cancelled) return;
        if (isAuthBillingAccessBlockedError(e)) {
          setMeRole(null);
          setEffectiveStaffAdmin(false);
          setMeUserId(null);
          setBillingDunningOpen(false);
          clearToken();
          clearTeamToken();
          navigate('/login', {
            replace: true,
            state: { billingAccessBlocked: true, billingMessage: e.message },
          });
          return;
        }
        if (isAuthSessionExpiredError(e)) {
          setMeRole(null);
          setEffectiveStaffAdmin(false);
          setMeUserId(null);
          setMeName(null);
          setMeEmail(null);
          setMePhone(null);
          setMeVehicleNumber(null);
          setTeamPreviewLink(false);
          setShowStagingDbImportMenu(false);
          setShowVolumeStatsMenu(false);
          setIsPlatformSupportAccess(false);
          setSuppressCelebrateBar(false);
          setTenantFeatures(null);
      setTenantTelecrm(null);
          setTenantPlan(null);
          setTenantName(null);
          setMeTenantId(null);
          setIsTenantOwner(false);
          setIsSuperAdmin(false);
          setCanCrmSettings(false);
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

  /** ADMIN — 로그인·메뉴(pathname) 이동마다 미결재 독촉 팝업 재시도 */
  useEffect(() => {
    if (meRole !== 'ADMIN' || !meTenantId || !adminToken) return;
    setBillingDunningOpen(false);
    setBillingDunningAttemptKey((k) => k + 1);
    const timer = window.setTimeout(() => setBillingDunningOpen(true), 0);
    return () => window.clearTimeout(timer);
  }, [location.pathname, meRole, meTenantId, adminToken]);

  useEffect(() => {
    if (!meRole) return;
    setNavOrder(loadAdminNavOrder(effectiveStaffAdmin, tenantFeatures));
  }, [meRole, effectiveStaffAdmin, tenantFeatures]);

  const navCtx = {
    isAdmin: effectiveStaffAdmin,
    role: meRole,
    marketerPermissions: staffMe?.marketerPermissions ?? null,
    enabledModules: tenantFeatures,
  };

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
    const isStaffAdminNav = effectiveStaffAdmin;
    if (!canShowAdminNavItem(dragId, navCtx) || !canShowAdminNavItem(targetId, navCtx)) return;
    setNavOrder((prev) => {
      const next = insertBefore(prev, dragId, targetId);
      saveAdminNavOrder(isStaffAdminNav, next);
      return next;
    });
    setDraggingNavId(null);
  };

  const fetchNavBadgesNow = useCallback(() => {
    const token = getToken();
    if (!token) return;
    getAdminNavBadges(token)
      .then((r) => {
        setUnreadCount(r.unreadCount);
        setCsPendingCount(r.csPendingCount);
        setReviewPaybackUnseenCount(r.reviewPaybackUnseenCount);
        setLeadsPendingCount(r.leadsPendingCount);
        notifyInquiriesSubNavBadgesRefresh();
      })
      .catch(() => {});
    if (tenantFeatures && hasFeature(tenantFeatures, 'mod_db_marketplace')) {
      void getDbMarketplaceNavCounts(token)
        .then(({ draftCount, openCount, sellerPendingCount, buyerPendingCount }) => {
          setMarketplaceDraftCount(draftCount);
          setMarketplaceOpenCount(openCount);
          setMarketplaceSellerPendingCount(sellerPendingCount);
          setMarketplaceBuyerPendingCount(buyerPendingCount);
        })
        .catch(() => {
          setMarketplaceDraftCount(0);
          setMarketplaceOpenCount(0);
          setMarketplaceSellerPendingCount(0);
          setMarketplaceBuyerPendingCount(0);
        });
    }
  }, [tenantFeatures]);

  const fetchNavBadges = useDebouncedCallback(fetchNavBadgesNow, 400);

  useEffect(() => {
    fetchNavBadgesNow();
  }, [fetchNavBadgesNow]);

  /** 자주 쓰는 GNB 메뉴 청크 — 세션 준비 직후 선로드(스케줄 우선) */
  useEffect(() => {
    if (!adminToken || meProfileLoading || !meRole) return;
    prefetchAdminNavPage('schedule');
    return runWhenIdle(() => {
      prefetchAdminNavPage('inquiries');
      prefetchAdminNavPage('messages');
      prefetchTeamLeadersSettlementPages();
    });
  }, [adminToken, meProfileLoading, meRole]);

  useReviewPaybackRealtime(
    adminToken,
    (p) => {
      setReviewPaybackToast(p.summary || `${p.customerName} 페이백/리뷰 신청`);
      if (reviewPaybackToastTimer.current) clearTimeout(reviewPaybackToastTimer.current);
      reviewPaybackToastTimer.current = setTimeout(() => setReviewPaybackToast(null), 6000);
      fetchNavBadges();
    },
    Boolean(adminToken && (meRole === 'ADMIN' || meRole === 'MARKETER')),
  );

  const canReceiveLandingContactAlert = Boolean(
    adminToken &&
      (meRole === 'ADMIN' || meRole === 'MARKETER') &&
      tenantFeatures &&
      hasFeature(tenantFeatures, 'mod_landing_inquiry'),
  );

  useLandingContactRealtime(
    adminToken,
    (p) => {
      openLandingContactStrip(p);
      fetchNavBadges();
    },
    canReceiveLandingContactAlert,
  );

  const canReceiveMarketplaceHandoffConfirmedAlert = Boolean(
    adminToken &&
      (meRole === 'ADMIN' || meRole === 'MARKETER') &&
      tenantFeatures &&
      hasFeature(tenantFeatures, 'mod_db_marketplace'),
  );

  useDbMarketplaceHandoffConfirmedRealtime(
    adminToken,
    (p) => {
      if (p.buyerKind !== 'PARTNER_TENANT') return;
      openMarketplaceHandoffConfirmedStrip(p);
      fetchNavBadges();
    },
    canReceiveMarketplaceHandoffConfirmedAlert,
  );

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

  const handleLogout = () => {
    clearToken();
    clearTeamToken();
    navigate('/login');
  };

  const navClass = ({ isActive }: { isActive: boolean }) => adminGnbItemClass(isActive);

  const adminNavHintKey = `${location.pathname}|${unreadCount}|${csPendingCount}|${reviewPaybackUnseenCount}|${leadsPendingCount}|${marketplaceDraftCount}|${marketplaceSellerPendingCount}|${marketplaceBuyerPendingCount}|${navOrder.join(',')}`;

  const teamLeadersActive =
    location.pathname === '/admin/team-leaders' ||
    location.pathname.startsWith('/admin/team-leaders/');

  const showScheduleFab =
    Boolean(fabTop != null) && !location.pathname.startsWith('/admin/schedule');
  const showOrderIssueFab =
    Boolean(fabTop != null) && !location.pathname.startsWith('/admin/inquiries/order-issue');
  const showMobileFabStack = Boolean(fabTop != null);
  const fabSafeRight = 'max(12px, env(safe-area-inset-right, 0px))';

  useEffect(() => {
    fabStackCountRef.current =
      1 + (showOrderIssueFab ? 1 : 0) + (showScheduleFab ? 1 : 0) + 1;
  }, [showOrderIssueFab, showScheduleFab]);

  /** FAB 스택 top — 저장·드래그는 컨테이너 세로 위치만 사용 */
  const clampFabTop = useCallback((stackTop: number) => {
    if (typeof window === 'undefined') return stackTop;
    const count = fabStackCountRef.current;
    const stackHeight =
      count * ADMIN_MOBILE_FAB_PX + Math.max(0, count - 1) * ADMIN_MOBILE_FAB_GAP;
    const margin = 12;
    const minY = 72;
    const maxY = Math.max(minY, window.innerHeight - margin - stackHeight);
    return Math.min(maxY, Math.max(minY, stackTop));
  }, []);

  const applyFabTopDom = useCallback((next: number) => {
    fabTopRef.current = next;
    const el = fabStackRef.current;
    if (el) el.style.top = `${next}px`;
  }, []);

  useEffect(() => {
    fabTopRef.current = fabTop;
  }, [fabTop]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    /** 기본 위치: 화면 중하단보다 조금 위(엄지 영역·3버튼 스택 여유) */
    const fallbackY = clampFabTop(Math.round(window.innerHeight * 0.38));
    try {
      const raw = window.localStorage.getItem(fabStorageKey);
      if (!raw) {
        setFabTop(fallbackY);
        fabTopRef.current = fallbackY;
        return;
      }
      const parsed = JSON.parse(raw) as { v?: number; x?: number; y?: number };
      const y = typeof parsed?.y === 'number' ? parsed.y : undefined;
      let stackTop = y;
      if (stackTop != null && parsed?.v !== 2) {
        /** v1: 스케줄 버튼 top 기준 → 스택 top(맨 위 버튼)으로 이전 */
        stackTop = stackTop - ADMIN_MOBILE_FAB_ISSUE_TOP_OFFSET;
      }
      const clamped = stackTop != null ? clampFabTop(stackTop) : fallbackY;
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

  const clearFabPressListeners = useCallback(() => {
    endFabPressListenersRef.current?.();
    endFabPressListenersRef.current = null;
  }, []);

  const clearFabDragListeners = useCallback(() => {
    endFabDragListenersRef.current?.();
    endFabDragListenersRef.current = null;
  }, []);

  const finishFabPointer = useCallback(
    (evt: PointerEvent, wasDragging: boolean) => {
      try {
        fabCaptureTargetRef.current?.releasePointerCapture(evt.pointerId);
      } catch {
        /* ignore */
      }
      fabCaptureTargetRef.current = null;
      fabPointerIdRef.current = null;
      const tapAnchor = fabPointerAnchorRef.current;
      fabPointerAnchorRef.current = null;
      fabDraggingRef.current = false;
      setFabDragging(false);
      setFabPressActive(false);

      if (wasDragging) {
        const y = fabTopRef.current;
        if (y != null) {
          setFabTop(y);
          try {
            window.localStorage.setItem(fabStorageKey, JSON.stringify({ v: 2, y }));
          } catch {
            /* localStorage 사용 불가 환경 무시 */
          }
        }
        return;
      }

      if (!fabPressMovedRef.current) {
        if (tapAnchor === 'issue') {
          const pid = getScheduleDetailInquiryIdForOrderFab();
          if (pid) {
            navigate(`/admin/inquiries/order-issue?pendingInquiryId=${encodeURIComponent(pid)}`);
          } else if (location.pathname.startsWith('/admin/schedule')) {
            navigate('/admin/inquiries/order-issue?fabHint=scheduleNoDetail');
          } else {
            navigate('/admin/inquiries/order-issue');
          }
        } else if (tapAnchor === 'schedule') {
          navigate('/admin/schedule');
        } else if (tapAnchor === 'favorites') {
          openMobileFavoritesRef.current?.();
        }
      }
      fabPressMovedRef.current = false;
    },
    [fabStorageKey, location.pathname, navigate],
  );

  const attachFabDragListeners = useCallback(
    (pointerId: number) => {
      clearFabDragListeners();
      const onMove = (evt: PointerEvent) => {
        if (fabPointerIdRef.current == null || evt.pointerId !== pointerId) return;
        evt.preventDefault();
        applyFabTopDom(clampFabTop(evt.clientY - fabDragOffsetRef.current.y));
      };
      const onUp = (evt: PointerEvent) => {
        if (fabPointerIdRef.current == null || evt.pointerId !== pointerId) return;
        clearFabDragListeners();
        finishFabPointer(evt, true);
      };
      window.addEventListener('pointermove', onMove, { passive: false });
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onUp);
      endFabDragListenersRef.current = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onUp);
      };
    },
    [applyFabTopDom, clampFabTop, clearFabDragListeners, finishFabPointer],
  );

  const beginFabPointer = useCallback(
    (anchor: 'schedule' | 'issue' | 'bell' | 'favorites', evt: ReactPointerEvent<HTMLButtonElement>) => {
      if (evt.button !== 0) return;
      clearFabPressListeners();
      clearFabDragListeners();
      if (fabHoldTimerRef.current != null) window.clearTimeout(fabHoldTimerRef.current);

      const pointerId = evt.pointerId;
      const downAt = Date.now();
      fabPointerAnchorRef.current = anchor;
      fabPressMovedRef.current = false;
      fabPointerIdRef.current = pointerId;
      fabCaptureTargetRef.current = evt.currentTarget;
      setFabPressActive(true);
      const container = fabStackRef.current;
      const rect = container?.getBoundingClientRect() ?? evt.currentTarget.getBoundingClientRect();
      fabDragOffsetRef.current = { y: evt.clientY - rect.top };

      const down = { x: evt.clientX, y: evt.clientY };

      const enterDragMode = () => {
        if (fabDraggingRef.current || fabPointerIdRef.current !== pointerId) return;
        clearFabPressListeners();
        if (fabHoldTimerRef.current != null) {
          window.clearTimeout(fabHoldTimerRef.current);
          fabHoldTimerRef.current = null;
        }
        fabDraggingRef.current = true;
        setFabDragging(true);
        try {
          fabCaptureTargetRef.current?.setPointerCapture(pointerId);
        } catch {
          /* ignore */
        }
        try {
          navigator.vibrate?.(12);
        } catch {
          /* ignore */
        }
        attachFabDragListeners(pointerId);
      };

      const onEarlyMove = (moveEvt: PointerEvent) => {
        if (fabPointerIdRef.current == null || moveEvt.pointerId !== pointerId) return;
        const dx = Math.abs(moveEvt.clientX - down.x);
        const dy = Math.abs(moveEvt.clientY - down.y);
        if (dx + dy > 4) fabPressMovedRef.current = true;

        if (fabDraggingRef.current) return;

        if (dx > ADMIN_MOBILE_FAB_HORIZONTAL_CANCEL_DX_PX && dx > dy * 1.2) {
          if (fabHoldTimerRef.current != null) {
            window.clearTimeout(fabHoldTimerRef.current);
            fabHoldTimerRef.current = null;
          }
          return;
        }

        const elapsed = Date.now() - downAt;
        if (dy >= ADMIN_MOBILE_FAB_EARLY_DRAG_DY_PX && dy >= dx && elapsed >= ADMIN_MOBILE_FAB_EARLY_DRAG_MS) {
          enterDragMode();
        }
      };

      const onEarlyUp = (upEvt: PointerEvent) => {
        if (fabPointerIdRef.current == null || upEvt.pointerId !== pointerId) return;
        if (fabHoldTimerRef.current != null) {
          window.clearTimeout(fabHoldTimerRef.current);
          fabHoldTimerRef.current = null;
        }
        clearFabPressListeners();
        if (!fabDraggingRef.current) {
          finishFabPointer(upEvt, false);
        }
      };

      window.addEventListener('pointermove', onEarlyMove, { passive: true });
      window.addEventListener('pointerup', onEarlyUp);
      window.addEventListener('pointercancel', onEarlyUp);
      endFabPressListenersRef.current = () => {
        window.removeEventListener('pointermove', onEarlyMove);
        window.removeEventListener('pointerup', onEarlyUp);
        window.removeEventListener('pointercancel', onEarlyUp);
      };

      fabHoldTimerRef.current = window.setTimeout(() => {
        fabHoldTimerRef.current = null;
        enterDragMode();
      }, ADMIN_MOBILE_FAB_HOLD_MS);
    },
    [attachFabDragListeners, clearFabDragListeners, clearFabPressListeners, finishFabPointer],
  );

  useLayoutEffect(
    () => () => {
      if (fabHoldTimerRef.current != null) window.clearTimeout(fabHoldTimerRef.current);
      clearFabPressListeners();
      clearFabDragListeners();
    },
    [clearFabDragListeners, clearFabPressListeners],
  );

  return (
    <NavFavoritesProvider app="admin" tenantSlug={tenantSlug} userId={meUserId}>
    <div className="relative min-h-0 h-dvh max-h-dvh bg-[#edf0f5] flex flex-col overflow-hidden font-sans antialiased">
      {/* 배경 그라데이션 오브 (요즘 트렌드 데코) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 max-lg:bg-[#edf0f5]" aria-hidden="true">
        {/* 좌상단 퍼플-인디고 조명 — lg 이상에서만 blur 오브 (모바일 GPU 부담) */}
        <div className="hidden lg:block absolute -top-[20%] -left-[10%] w-[70%] h-[60%] rounded-full bg-gradient-to-br from-indigo-500/16 to-purple-500/10 blur-[100px] opacity-80" />
        {/* 우하단 블루-스카이 조명 */}
        <div className="hidden lg:block absolute -bottom-[20%] -right-[10%] w-[70%] h-[60%] rounded-full bg-gradient-to-br from-blue-500/16 to-sky-500/10 blur-[100px] opacity-80" />
        {/* 상단 중앙 소프트 스포트라이트 */}
        <div className="hidden lg:block absolute top-0 left-1/2 -translate-x-1/2 w-[95%] h-[350px] rounded-full bg-indigo-500/8 blur-[120px] opacity-80" />
      </div>
      {reviewPaybackToast ? (
        <button
          type="button"
          role="status"
          onClick={() => navigate('/admin/inquiries/review-payback')}
          className="fixed bottom-4 right-4 z-[60] max-w-sm rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-left text-fluid-xs text-amber-950 shadow-lg hover:bg-amber-100"
        >
          {reviewPaybackToast}
          <span className="mt-1 block text-[10px] text-amber-800">탭하여 페이백/리뷰 목록 열기</span>
        </button>
      ) : null}
      <div className="staff-top-safe shrink-0 relative z-20">
      {celebration != null && (
        <div
          className="grid shrink-0 transition-[grid-template-rows] duration-300 ease-out"
          style={{ gridTemplateRows: celebrationOpen ? '1fr' : '0fr' }}
          aria-hidden={!celebrationOpen}
        >
          <div className="min-h-0 overflow-hidden">
            <div
              className="relative bg-gradient-to-r from-amber-500 to-amber-600 text-white border-b border-amber-700/30"
            >
              {celebration.inquiryId ? (
                <button
                  type="button"
                  role="status"
                  aria-live="polite"
                  aria-label="접수 상세 열기"
                  onClick={() => openCelebrateInquiry(celebration.inquiryId!)}
                  className="flex w-full items-center justify-center px-10 py-1.5 sm:px-12 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/80"
                >
                  <p className="text-center text-[11px] sm:text-xs font-medium leading-tight max-w-4xl [text-wrap:pretty]">
                    {formatCelebrateBannerFromConfig(celebration)}
                    <span className="font-normal text-amber-100/90"> · 탭하여 접수 상세</span>
                  </p>
                </button>
              ) : (
                <div
                  role="status"
                  aria-live="polite"
                  className="flex items-center justify-center px-10 py-1.5 sm:px-12"
                >
                  <p className="text-center text-[11px] sm:text-xs font-medium leading-tight max-w-4xl [text-wrap:pretty]">
                    {formatCelebrateBannerFromConfig(celebration)}
                  </p>
                </div>
              )}
              <button
                type="button"
                aria-label="닫기"
                onClick={closeCelebrateStrip}
                className="absolute right-0.5 top-1/2 -translate-y-1/2 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                  <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
      {landingContactAlert != null ? (
        <div
          className="grid shrink-0 transition-[grid-template-rows] duration-300 ease-out"
          style={{ gridTemplateRows: landingContactAlertOpen ? '1fr' : '0fr' }}
          aria-hidden={!landingContactAlertOpen}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="relative border-b border-red-800/30 bg-gradient-to-r from-red-600 to-red-700 text-white">
              <button
                type="button"
                role="status"
                aria-live="polite"
                aria-label="문의내역 열기"
                onClick={openLandingContactLeads}
                className="flex w-full items-center justify-center bg-gradient-to-r from-red-600 to-red-700 px-10 py-1.5 hover:from-red-700 hover:to-red-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/80 sm:px-12"
              >
                <p className="max-w-4xl text-center text-[11px] font-semibold leading-tight [text-wrap:pretty] sm:text-xs">
                  {landingContactAlert.customerName ? (
                    <>
                      <span className="font-bold">{landingContactAlert.customerName}</span>님 랜딩 문의가
                      접수되었습니다
                    </>
                  ) : (
                    '신규 랜딩 문의가 접수되었습니다'
                  )}
                  {landingContactAlert.brandName ? (
                    <span className="font-normal text-red-100"> · {landingContactAlert.brandName}</span>
                  ) : null}
                  <span className="font-normal text-red-100/90"> · 탭하여 문의내역</span>
                </p>
              </button>
              <button
                type="button"
                aria-label="닫기"
                onClick={closeLandingContactStrip}
                className="absolute right-0.5 top-1/2 flex h-7 w-7 shrink-0 -translate-y-1/2 items-center justify-center rounded-md text-white hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                  <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {showMarketplaceHandoffStrip &&
      marketplaceHandoffStripDismissedCount !== marketplaceSellerPendingCount ? (
        <div
          className="grid shrink-0 transition-[grid-template-rows] duration-300 ease-out"
          style={{ gridTemplateRows: marketplaceHandoffStripOpen ? '1fr' : '0fr' }}
          aria-hidden={!marketplaceHandoffStripOpen}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="relative border-b border-orange-700/30 bg-gradient-to-r from-orange-500 to-amber-500 text-white">
              <button
                type="button"
                role="status"
                aria-live="polite"
                aria-label="정보공유 진행 중 탭 열기"
                onClick={openMarketplaceHandoffPending}
                className="flex w-full items-center justify-center bg-gradient-to-r from-orange-500 to-amber-500 px-10 py-1.5 hover:from-orange-600 hover:to-amber-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/80 sm:px-12"
              >
                <p className="max-w-4xl text-center text-[11px] font-semibold leading-tight [text-wrap:pretty] sm:text-xs">
                  거래처가 정보를 인계 요청합니다
                  {marketplaceSellerPendingCount > 1
                    ? ` · ${marketplaceSellerPendingCount}건`
                    : ''}
                  <span className="font-normal text-orange-50/95"> · 탭하여 진행 중</span>
                </p>
              </button>
              <button
                type="button"
                aria-label="닫기"
                onClick={closeMarketplaceHandoffStrip}
                className="absolute right-0.5 top-1/2 flex h-7 w-7 shrink-0 -translate-y-1/2 items-center justify-center rounded-md text-white hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                  <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {marketplaceHandoffConfirmedAlert != null ? (
        <div
          className="grid shrink-0 transition-[grid-template-rows] duration-300 ease-out"
          style={{ gridTemplateRows: marketplaceHandoffConfirmedAlertOpen ? '1fr' : '0fr' }}
          aria-hidden={!marketplaceHandoffConfirmedAlertOpen}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="relative border-b border-emerald-800/30 bg-gradient-to-r from-emerald-600 to-green-600 text-white">
              <button
                type="button"
                role="status"
                aria-live="polite"
                aria-label="구매 접수 열기"
                onClick={openMarketplaceHandoffConfirmedInquiry}
                className="flex w-full items-center justify-center bg-gradient-to-r from-emerald-600 to-green-600 px-10 py-1.5 hover:from-emerald-700 hover:to-green-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/80 sm:px-12"
              >
                <p className="max-w-4xl text-center text-[11px] font-semibold leading-tight [text-wrap:pretty] sm:text-xs">
                  구매한 접수건이 인계가 완료되었습니다
                  {marketplaceHandoffConfirmedAlert.customerName ? (
                    <span className="font-normal text-emerald-50">
                      {' '}
                      · {marketplaceHandoffConfirmedAlert.customerName}
                    </span>
                  ) : null}
                  {marketplaceHandoffConfirmedAlert.sellerTenantName ? (
                    <span className="font-normal text-emerald-50/95">
                      {' '}
                      · {marketplaceHandoffConfirmedAlert.sellerTenantName}
                    </span>
                  ) : null}
                  <span className="font-normal text-emerald-50/95"> · 탭하여 접수</span>
                </p>
              </button>
              <button
                type="button"
                aria-label="닫기"
                onClick={closeMarketplaceHandoffConfirmedStrip}
                className="absolute right-0.5 top-1/2 flex h-7 w-7 shrink-0 -translate-y-1/2 items-center justify-center rounded-md text-white hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                  <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <header className="px-3 sm:px-4 lg:px-5 py-2.5 shadow-md theme-dark-header">
        <div className="w-full flex flex-col gap-2 min-w-0">
          <div className="md:hidden flex items-center justify-between gap-2 min-w-0">
            <div className="flex min-w-0 shrink items-center gap-1.5">
              <button
                type="button"
                onClick={goAdminHomeWithRefresh}
                className="min-w-0 shrink-0 text-left hover:opacity-90 transition-opacity"
                aria-label="청소비서 — 대시보드로 이동"
                title="대시보드로 이동"
              >
                <TenantBrandLogo height={28} />
              </button>
              {adminToken ? (
                <ScheduleAlertSiren
                  token={adminToken}
                  variant="header"
                  onOpenSchedule={openScheduleFromAlert}
                />
              ) : null}
            </div>
            <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 shrink-0">
              {teamPreviewLink ? (
                <AdminDevPreviewLinks adminToken={adminToken} compact />
              ) : null}
              {showVolumeStatsMenu ? <AdminVolumeStatsButton adminToken={adminToken} /> : null}
              <UserProfileMenu
                token={adminToken}
                tenantName={tenantName}
                me={{ name: meName, phone: mePhone, vehicleNumber: meVehicleNumber, role: meRole }}
                loading={meProfileLoading}
                showStagingDbImport={showStagingDbImportMenu}
                onStagingDbImport={() => setStagingDbImportModalOpen(true)}
                teamNotificationSettingsHref={
                  meRole === 'ADMIN' || meRole === 'MARKETER' ? '/admin/notification-settings' : null
                }
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
            <DarkHeaderNavScroll
              className="w-full"
              aria-label="관리자 메뉴"
              hintKey={adminNavHintKey}
            >
              <button
                type="button"
                onClick={goAdminHomeWithRefresh}
                className="hidden md:block shrink-0 hover:opacity-90 transition-opacity"
                aria-label="청소비서 — 대시보드로 이동"
                title="대시보드로 이동"
              >
                <TenantBrandLogo height={32} />
              </button>
              <nav className="flex flex-row flex-nowrap items-center gap-1 shrink-0">
                {navOrder.map((id) => {
                  if (id === 'dashboard') return null;
                  if (!canShowAdminNavItem(id, navCtx)) return null;
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
                      className="hidden md:inline-grid grid-cols-2 gap-px px-0.5 py-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing select-none touch-none shrink-0"
                    >
                      {Array.from({ length: 6 }).map((_, i) => (
                        <span key={i} className="w-[3px] h-[3px] rounded-full bg-current" aria-hidden />
                      ))}
                    </span>
                  );
                  const rowClass = `inline-flex flex-nowrap items-center gap-0.5 rounded-xl shrink-0 ${
                    dragging ? 'opacity-40' : ''
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
                          data-admin-gnb-item
                          onMouseEnter={() => prefetchTeamLeadersSettlementPages()}
                          onFocus={() => prefetchTeamLeadersSettlementPages()}
                        >
                          <AdminGnbItemContent id={id} label={def.label} />
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
                            data-admin-gnb-item
                            {...adminNavPrefetchHandlers('messages')}
                            aria-label={
                              unreadCount > 0 ? `${def.label}, 새 메시지 ${unreadCount}건` : def.label
                            }
                          >
                            <AdminGnbItemContent id={id} label={def.label} />
                          </NavLink>
                          {unreadCount > 0 ? (
                            <span
                              className="-ml-2 inline-flex min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-amber-400 px-1.5 py-0.5 text-center text-[clamp(0.55rem,1.2vw,0.75rem)] font-bold leading-none text-slate-950 tabular-nums motion-safe:animate-pulse motion-reduce:animate-none sm:-ml-3"
                              aria-hidden
                            >
                              {unreadCount}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  }
                  if (id === 'inquiries') {
                    const inquiriesNavBadge = reviewPaybackUnseenCount + csPendingCount + leadsPendingCount;
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
                            data-admin-gnb-item
                            {...adminNavPrefetchHandlers('inquiries')}
                            aria-label={
                              inquiriesNavBadge > 0
                                ? `${def.label}, 하위 메뉴 알림 ${inquiriesNavBadge}건`
                                : def.label
                            }
                          >
                            <AdminGnbItemContent id={id} label={def.label} />
                          </NavLink>
                          {inquiriesNavBadge > 0 ? (
                            <span
                              className="-ml-2 inline-flex min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-amber-400 px-1.5 py-0.5 text-center text-[clamp(0.55rem,1.2vw,0.75rem)] font-bold leading-none text-slate-950 tabular-nums motion-safe:animate-pulse motion-reduce:animate-none sm:-ml-3"
                              aria-hidden
                            >
                              {inquiriesNavBadge > 99 ? '99+' : inquiriesNavBadge}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    );
                  }
                  if (id === 'db-marketplace') {
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
                            data-admin-gnb-item
                            aria-label={
                              marketplaceDraftCount > 0 ||
                              marketplaceOpenCount > 0 ||
                              marketplaceSellerPendingCount > 0 ||
                              marketplaceBuyerPendingCount > 0
                                ? `${def.label}, 준비 ${marketplaceDraftCount}건${
                                    marketplaceOpenCount > 0 ? `, 공유 중 ${marketplaceOpenCount}건` : ''
                                  }${
                                    marketplaceSellerPendingCount > 0
                                      ? `, 인계 대기 ${marketplaceSellerPendingCount}건`
                                      : ''
                                  }${
                                    marketplaceBuyerPendingCount > 0
                                      ? `, 인수 진행 ${marketplaceBuyerPendingCount}건`
                                      : ''
                                  }`
                                : def.label
                            }
                          >
                            <AdminGnbItemContent id={id} label={def.label} />
                          </NavLink>
                          {marketplaceSellerPendingCount > 0 ? (
                            <Link
                              to="/admin/db-marketplace?side=share&tab=pending"
                              className="-ml-2 inline-flex min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-amber-400 px-1.5 py-0.5 text-center text-[clamp(0.55rem,1.2vw,0.75rem)] font-bold leading-none text-slate-950 tabular-nums motion-safe:animate-pulse motion-reduce:animate-none sm:-ml-3 hover:bg-amber-300"
                              aria-label={`인계 대기 ${marketplaceSellerPendingCount}건`}
                              title="인계 대기 — 공유 · 대기 탭"
                            >
                              {marketplaceSellerPendingCount > 99 ? '99+' : marketplaceSellerPendingCount}
                            </Link>
                          ) : null}
                          {marketplaceBuyerPendingCount > 0 ? (
                            <Link
                              to="/admin/db-marketplace?side=receive&tab=pending"
                              className="-ml-2 inline-flex min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-sky-400 px-1.5 py-0.5 text-center text-[clamp(0.55rem,1.2vw,0.75rem)] font-bold leading-none text-slate-950 tabular-nums sm:-ml-3 hover:bg-sky-300"
                              aria-label={`인수 진행 ${marketplaceBuyerPendingCount}건`}
                              title="인수 진행 — 받기 · 진행 탭"
                            >
                              {marketplaceBuyerPendingCount > 99 ? '99+' : marketplaceBuyerPendingCount}
                            </Link>
                          ) : null}
                          {marketplaceOpenCount > 0 ? (
                            <Link
                              to="/admin/db-marketplace?side=share&tab=open"
                              className="-ml-2 inline-flex min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-sky-500 px-1.5 py-0.5 text-center text-[clamp(0.55rem,1.2vw,0.75rem)] font-bold leading-none text-white tabular-nums sm:-ml-3 hover:bg-sky-400"
                              aria-label={`공유 중 ${marketplaceOpenCount}건`}
                              title="공유 중 — 공유 · 공유중 탭"
                            >
                              {marketplaceOpenCount > 99 ? '99+' : marketplaceOpenCount}
                            </Link>
                          ) : null}
                          {marketplaceDraftCount > 0 ? (
                            <Link
                              to="/admin/db-marketplace?side=share&tab=draft"
                              className="-ml-2 inline-flex min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-violet-400 px-1.5 py-0.5 text-center text-[clamp(0.55rem,1.2vw,0.75rem)] font-bold leading-none text-slate-950 tabular-nums sm:-ml-3 hover:bg-violet-300"
                              aria-label={`공유 준비 ${marketplaceDraftCount}건`}
                              title="공유 준비 — 공유 · 준비 탭"
                            >
                              {marketplaceDraftCount}
                            </Link>
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
                      <NavLink
                        to={def.to}
                        className={navClass}
                        data-admin-gnb-item
                        {...(id === 'schedule' || id === 'advertising'
                          ? adminNavPrefetchHandlers(id)
                          : {})}
                      >
                        <AdminGnbItemContent id={id} label={def.label} />
                      </NavLink>
                    </div>
                  );
                })}
              </nav>
            </DarkHeaderNavScroll>
          </div>
          <div className="hidden md:flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
            {teamPreviewLink ? <AdminDevPreviewLinks adminToken={adminToken} /> : null}
            {showVolumeStatsMenu ? <AdminVolumeStatsButton adminToken={adminToken} /> : null}
            {adminToken ? (
              <ScheduleAlertSiren
                token={adminToken}
                variant="header"
                onOpenSchedule={openScheduleFromAlert}
              />
            ) : null}
            <UserProfileMenu
              token={adminToken}
              tenantName={tenantName}
              me={{ name: meName, phone: mePhone, vehicleNumber: meVehicleNumber, role: meRole }}
              loading={meProfileLoading}
              showStagingDbImport={showStagingDbImportMenu}
              onStagingDbImport={() => setStagingDbImportModalOpen(true)}
              teamNotificationSettingsHref={
                meRole === 'ADMIN' || meRole === 'MARKETER' ? '/admin/notification-settings' : null
              }
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
      </div>
      <main className="staff-app-surface relative z-10 w-full px-3 sm:px-4 lg:px-5 lg:pr-12 py-3 lg:py-4 min-w-0 flex-1 flex flex-col min-h-0 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
        {isPlatformSupportAccess ? (
          <div className="mb-4 rounded-lg border border-violet-300 bg-violet-50 px-4 py-2.5 text-sm text-violet-900">
            플랫폼 <strong className="font-semibold">지원 접속</strong> 모드입니다. 장애 확인·복구 목적으로만
            사용하고, 작업 후 로그아웃해 주세요.
          </div>
        ) : null}
        <TenantCapabilitiesProvider value={{ features: tenantFeatures, plan: tenantPlan, tenantSlug, telecrm: tenantTelecrm }}>
          <AdminStaffSessionProvider
            value={{
              ready: Boolean(meRole),
              tenantName,
              role: meRole,
              staffMe,
              isTenantOwner,
              isSuperAdmin,
              canCrmSettings,
              userId: meUserId,
              userName: meName,
              userPhone: mePhone,
              userEmail: meEmail,
            }}
          >
            <AdminStaffPathGate staffMe={staffMe}>
              <div className="flex min-h-0 min-w-0 w-full flex-1 flex-col">
                <Outlet />
              </div>
            </AdminStaffPathGate>
          </AdminStaffSessionProvider>
        </TenantCapabilitiesProvider>
      </main>
          {showMobileFabStack && (
        <div
          ref={fabStackRef}
          className={`fixed z-[120] lg:hidden flex flex-col items-end gap-0.5 ${
            fabDragging || fabPressActive ? 'touch-none select-none' : ''
          }`}
          style={{
            top: fabTop ?? undefined,
            right: fabSafeRight,
          }}
        >
          <AdminMobileNavFavoritesAccess
            navCtx={navCtx}
            role={meRole}
            marketerPermissions={staffMe?.marketerPermissions ?? null}
            registerOpen={(fn) => {
              openMobileFavoritesRef.current = fn;
            }}
            fabStack={{ onPointerDown: (evt) => beginFabPointer('favorites', evt) }}
          />
          {showOrderIssueFab && (
            <button
              type="button"
              aria-label="발주서 발급으로 이동"
              title={fabDragging ? '세로 위치 이동 중' : '발주서 발급 (길게 눌러 세로 위치만 이동)'}
              onPointerDown={(evt) => beginFabPointer('issue', evt)}
              className={`${MOBILE_STAFF_DOCK_BTN_CLASS} border border-amber-600/70 bg-amber-400 text-amber-950 shadow-[0_2px_8px_rgba(180,83,9,0.28),0_1px_2px_rgba(15,23,42,0.1)] ring-1 ring-inset ring-white/30 active:shadow-sm ${
                fabDragging ? 'cursor-grabbing' : 'cursor-pointer'
              }`}
            >
              <OrderIssueFabIcon className={MOBILE_STAFF_DOCK_ICON_CLASS} />
            </button>
          )}
          {showScheduleFab && (
            <button
              type="button"
              aria-label="스케줄 바로가기"
              title={fabDragging ? '세로 위치 이동 중' : '스케줄 바로가기 (길게 눌러 세로 위치만 이동)'}
              onPointerDown={(evt) => beginFabPointer('schedule', evt)}
              className={`${MOBILE_STAFF_DOCK_BTN_CLASS} bg-gradient-to-b from-blue-600 to-blue-800 text-white shadow-[0_3px_10px_rgba(29,78,216,0.32),0_1px_3px_rgba(15,23,42,0.14)] ring-1 ring-inset ring-white/15 active:shadow-[0_2px_8px_rgba(29,78,216,0.26),0_1px_2px_rgba(15,23,42,0.12)] ${
                fabDragging ? 'cursor-grabbing' : 'cursor-pointer'
              }`}
            >
              <CalendarCuteIcon className={`${MOBILE_STAFF_DOCK_ICON_CLASS} drop-shadow-sm`} />
            </button>
          )}
          <div ref={setFabBellMount} className="contents" aria-hidden={!adminToken} />
        </div>
      )}
      <AdminStagingDbImportModal
        open={stagingDbImportModalOpen}
        onClose={() => setStagingDbImportModalOpen(false)}
        token={adminToken}
        onSessionExpired={() => {
          setStagingDbImportModalOpen(false);
          clearToken();
          clearTeamToken();
          navigate('/login', { replace: true, state: { sessionExpired: true } });
        }}
      />
      <BillingDunningModal
        open={billingDunningOpen}
        token={adminToken}
        tenantId={meTenantId}
        attemptKey={billingDunningAttemptKey}
        onClose={closeBillingDunning}
      />
      {adminToken && profileOnboardingRequired && meRole === 'MARKETER' ? (
        <ProfileOnboardingModal
          open
          token={adminToken}
          initial={profileOnboardingInitial}
          onCompleted={() => {
            setProfileOnboardingRequired(false);
            getMe(adminToken)
              .then((u: {
                name?: string;
                phone?: string | null;
                profileOnboardingRequired?: boolean;
              }) => {
                setMeName(typeof u.name === 'string' && u.name.trim() ? u.name.trim() : null);
                setMePhone(typeof u.phone === 'string' && u.phone.trim() ? u.phone.trim() : null);
                setProfileOnboardingRequired(Boolean(u.profileOnboardingRequired));
              })
              .catch(() => {});
          }}
          onSessionExpired={() => {
            clearToken();
            clearTeamToken();
            navigate('/login', { replace: true, state: { sessionExpired: true } });
          }}
        />
      ) : null}
      {adminToken && (
        <ChangeLogBell
          token={adminToken}
          fetchUnseen={getUnseenChangeCount}
          fetchList={(t, opts) => getChangeHistoryList(t, opts)}
          markSeen={markChangeSeen}
          archivePageHref={meRole === 'ADMIN' ? '/admin/team-leaders/change-history' : undefined}
          onOpenInquiry={(inquiryId) =>
            navigate(`/admin/inquiries?openInquiry=${encodeURIComponent(inquiryId)}`)
          }
          mobileStack={
            showMobileFabStack
              ? {
                  onPointerDown: (evt) => beginFabPointer('bell', evt),
                  dragging: fabDragging,
                  mountNode: fabBellMount,
                }
              : undefined
          }
          desktopDock={
            changelogRailMount && desktopDockDrag
              ? { mountNode: changelogRailMount, ...desktopDockDrag }
              : null
          }
        />
      )}
      <AdminDesktopNavFavoritesAccess
        navCtx={navCtx}
        role={meRole}
        marketerPermissions={staffMe?.marketerPermissions ?? null}
        onChangelogMount={setChangelogRailMount}
        onDockDragChange={setDesktopDockDrag}
      />
    </div>
    </NavFavoritesProvider>
  );
}
