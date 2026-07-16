import {
  useState,
  useEffect,
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
import { resolveEffectiveStaffAdminFromMe, type StaffAdminMeFields } from '../../utils/staffAdminAccess';
import { useDebouncedCallback } from '../../utils/debounceCallback';
import {
  adminNavPrefetchHandlers,
  prefetchAdminNavPage,
  prefetchTeamLeadersSettlementPages,
} from '../../utils/prefetchAdminPages';
import { runWhenIdle } from '../../utils/deferWhenIdle';
import {
  useInboxRealtime,
  useInquiryCelebrateRealtime,
  useReviewPaybackRealtime,
  useLandingContactRealtime,
  type InquiryCelebratePayload,
  type LandingContactRtPayload,
} from '../../hooks/useInboxRealtime';
import { getMe, isAuthSessionExpiredError, isAuthBillingAccessBlockedError } from '../../api/auth';
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
import { ChangeLogBell } from '../admin/ChangeLogBell';
import { getUnseenChangeCount, getChangeHistoryList, markChangeSeen } from '../../api/inquiryChangeLogs';
import { AdminDevPreviewLinks } from '../admin/AdminDevPreviewLinks';
import { AdminVolumeStatsButton } from '../admin/AdminVolumeStatsButton';
import { isTeamPreviewAdminEmail } from '../../utils/teamPreview';
import { getScheduleDetailInquiryIdForOrderFab } from '../../utils/adminScheduleOrderFab';
import { TenantCapabilitiesProvider } from '../../hooks/useTenantCapabilities';
import {
  AdminStaffSessionProvider,
  resolveCanCrmSettingsFromMe,
} from '../../hooks/useAdminStaffSession';
import { hasFeature } from '@shared/tenantFeatureModules';
import { getDbMarketplaceNavCounts } from '../../api/dbMarketplace';
import { AdminStaffPathGate } from './AdminStaffPathGate';
import { DarkHeaderNavScroll } from './DarkHeaderNavScroll';

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

/** GNB 메뉴 — 아이콘·제목 가로 한 줄 (좁은 화면은 가로 스크롤) */
const ADMIN_GNB_ITEM_BASE =
  'inline-flex flex-row flex-nowrap items-center gap-1 px-2 py-1 text-fluid-xs font-semibold rounded-xl whitespace-nowrap shrink-0 touch-manipulation transition-all duration-200 hover:scale-[1.015] active:scale-[0.98] sm:gap-1.5 sm:px-3 sm:py-1.5';

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
      <AdminNavIcon id={id} className="h-4 w-4 shrink-0" />
      <span className="whitespace-nowrap leading-none">{label}</span>
    </>
  );
}

export function AdminLayout() {
  const adminToken = useSyncExternalStore(subscribeAdminAuth, getToken, () => null);
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  useEffect(() => {
    navigateRef.current = navigate;
  });
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [csPendingCount, setCsPendingCount] = useState(0);
  const [reviewPaybackUnseenCount, setReviewPaybackUnseenCount] = useState(0);
  const [leadsPendingCount, setLeadsPendingCount] = useState(0);
  const [marketplaceDraftCount, setMarketplaceDraftCount] = useState(0);
  const [marketplaceSellerPendingCount, setMarketplaceSellerPendingCount] = useState(0);
  const [marketplaceBuyerPendingCount, setMarketplaceBuyerPendingCount] = useState(0);
  const [reviewPaybackToast, setReviewPaybackToast] = useState<string | null>(null);
  const reviewPaybackToastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [meRole, setMeRole] = useState<string | null>(null);
  const [effectiveStaffAdmin, setEffectiveStaffAdmin] = useState(false);
  const [staffMe, setStaffMe] = useState<StaffAdminMeFields | null>(null);
  const [meUserId, setMeUserId] = useState<string | null>(null);
  const [meName, setMeName] = useState<string | null>(null);
  const [meEmail, setMeEmail] = useState<string | null>(null);
  const [mePhone, setMePhone] = useState<string | null>(null);
  const [meVehicleNumber, setMeVehicleNumber] = useState<string | null>(null);
  const [meProfileLoading, setMeProfileLoading] = useState(() => Boolean(adminToken));
  const [teamPreviewLink, setTeamPreviewLink] = useState(false);
  const [navOrder, setNavOrder] = useState<AdminNavId[]>(() => loadAdminNavOrder(false));
  const [draggingNavId, setDraggingNavId] = useState<AdminNavId | null>(null);
  const [fabTop, setFabTop] = useState<number | null>(null);
  const fabTopRef = useRef<number | null>(null);
  const [showStagingDbImportMenu, setShowStagingDbImportMenu] = useState(false);
  const [showVolumeStatsMenu, setShowVolumeStatsMenu] = useState(false);
  const [isPlatformSupportAccess, setIsPlatformSupportAccess] = useState(false);
  const [suppressCelebrateBar, setSuppressCelebrateBar] = useState(false);
  const [tenantFeatures, setTenantFeatures] = useState<readonly string[] | null>(null);
  const [tenantPlan, setTenantPlan] = useState<string | null>(null);
  const [tenantSlug, setTenantSlug] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState<string | null>(null);
  const [meTenantId, setMeTenantId] = useState<string | null>(null);
  const [isTenantOwner, setIsTenantOwner] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [canCrmSettings, setCanCrmSettings] = useState(false);
  useDocumentTitle(tenantName);
  const [stagingDbImportModalOpen, setStagingDbImportModalOpen] = useState(false);
  const [billingDunningOpen, setBillingDunningOpen] = useState(false);
  const closeBillingDunning = useCallback(() => setBillingDunningOpen(false), []);
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
      setTenantPlan(null);
      setTenantSlug(null);
      setTenantName(null);
      setMeTenantId(null);
      setIsTenantOwner(false);
      setIsSuperAdmin(false);
      setCanCrmSettings(false);
      setMeProfileLoading(false);
      return;
    }
    setMeProfileLoading(true);
    let cancelled = false;
    getMe(token)
      .then((u: {
        id?: string;
        role?: string;
        email?: string;
        name?: string;
        phone?: string | null;
        vehicleNumber?: string | null;
        showStagingDbImport?: boolean;
        showVolumeStats?: boolean;
        isPlatformSupportAccess?: boolean;
        isTenantOwner?: boolean;
        isSuperAdmin?: boolean;
        effectiveStaffAdminAccess?: boolean;
        marketerAdminAccess?: boolean;
        marketerPermissions?: StaffAdminMeFields['marketerPermissions'];
        features?: string[];
        tenant?: { id?: string; plan?: string; name?: string; displayName?: string; slug?: string } | null;
        tenantId?: string;
      }) => {
        if (cancelled) return;
        const role = typeof u.role === 'string' ? u.role : null;
        setMeRole(role);
        setStaffMe({
          role,
          effectiveStaffAdminAccess: u.effectiveStaffAdminAccess,
          marketerAdminLevel: (u as { marketerAdminLevel?: StaffAdminMeFields['marketerAdminLevel'] }).marketerAdminLevel,
          marketerPermissions: u.marketerPermissions ?? null,
          marketerOperationalAdminAccess: Boolean(
            (u as { marketerOperationalAdminAccess?: boolean }).marketerOperationalAdminAccess,
          ),
        });
        setEffectiveStaffAdmin(resolveEffectiveStaffAdminFromMe(u));
        setMeUserId(typeof u.id === 'string' ? u.id : null);
        setMeName(typeof u.name === 'string' && u.name.trim() ? u.name.trim() : null);
        setMeEmail(typeof u.email === 'string' && u.email.trim() ? u.email.trim() : null);
        setMePhone(typeof u.phone === 'string' && u.phone.trim() ? u.phone.trim() : null);
        setMeVehicleNumber(typeof u.vehicleNumber === 'string' && u.vehicleNumber.trim() ? u.vehicleNumber.trim() : null);
        setShowStagingDbImportMenu(Boolean(u.showStagingDbImport));
        setShowVolumeStatsMenu(Boolean(u.showVolumeStats));
        setIsPlatformSupportAccess(Boolean(u.isPlatformSupportAccess));
        const email = typeof u.email === 'string' ? u.email : '';
        setSuppressCelebrateBar(
          Boolean(u.isPlatformSupportAccess) || isTeamPreviewAdminEmail(email),
        );
        setTenantFeatures(Array.isArray(u.features) ? u.features : []);
        const tid =
          (typeof u.tenantId === 'string' && u.tenantId.trim()) ||
          (typeof u.tenant?.id === 'string' && u.tenant.id.trim()) ||
          null;
        setMeTenantId(tid);
        setTenantPlan(typeof u.tenant?.plan === 'string' ? u.tenant.plan : null);
        setTenantSlug(typeof u.tenant?.slug === 'string' ? u.tenant.slug : null);
        setTenantName(
          (typeof u.tenant?.displayName === 'string' && u.tenant.displayName.trim()) ||
            (typeof u.tenant?.name === 'string' && u.tenant.name.trim()) ||
            null,
        );
        setIsTenantOwner(Boolean(u.isTenantOwner));
        setIsSuperAdmin(Boolean(u.isSuperAdmin));
        setCanCrmSettings(resolveCanCrmSettingsFromMe(u));
        /** 팀·크루 미리보기: 업무 관리자(ADMIN) + 개발용 이메일 화이트리스트만. 일반 마케터는 제외 */
        const preview = role === 'ADMIN' || isTeamPreviewAdminEmail(email);
        setTeamPreviewLink(preview);
        if (preview && !getTeamToken()) {
          setTeamToken(token);
        }
        if (role === 'ADMIN' && tid) {
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
        .then(({ draftCount, sellerPendingCount, buyerPendingCount }) => {
          setMarketplaceDraftCount(draftCount);
          setMarketplaceSellerPendingCount(sellerPendingCount);
          setMarketplaceBuyerPendingCount(buyerPendingCount);
        })
        .catch(() => {
          setMarketplaceDraftCount(0);
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
  const fabSafeRight = 'max(12px, env(safe-area-inset-right, 0px))';
  /** 발주서 FAB top — 스케줄과 같이 있을 때만 위로 스택 */
  const issueFabTopPx =
    fabTop == null
      ? undefined
      : showScheduleFab && showOrderIssueFab
        ? Math.max(8, fabTop - ADMIN_MOBILE_FAB_ISSUE_TOP_OFFSET)
        : fabTop;

  useEffect(() => {
    fabBothStackedRef.current = showScheduleFab && showOrderIssueFab;
  });

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
        } else navigate('/admin/schedule');
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
  }, [clampFabTop, fabDragging, navigate, location.pathname]);

  return (
    <div className="relative min-h-0 h-dvh max-h-dvh bg-[#edf0f5] flex flex-col overflow-hidden font-sans antialiased">
      {/* 배경 그라데이션 오브 (요즘 트렌드 데코) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 max-lg:bg-[#edf0f5]" aria-hidden="true">
        {/* 좌상단 퍼플-인디고 조명 — lg 이상에서만 blur 오브 (모바일 GPU 부담) */}
        <div className="hidden lg:block absolute -top-[20%] -left-[10%] w-[70%] h-[60%] rounded-full bg-gradient-to-br from-indigo-500/16 to-purple-500/10 blur-[100px] opacity-80" />
        {/* 우하단 블루-스카이 조명 */}
        <div className="hidden lg:block absolute -bottom-[20%] -right-[10%] w-[70%] h-[60%] rounded-full bg-gradient-to-br from-blue-500/16 to-sky-500/10 blur-[100px] opacity-80" />
        {/* 상단 중앙 소프트 스포트라이트 */}
        <div className="hidden lg:block absolute top-0 left-1/2 -translate-x-1/2 w-[90%] max-w-[1400px] h-[350px] rounded-full bg-indigo-500/8 blur-[120px] opacity-80" />
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
                  className="flex w-full flex-col items-center justify-center px-8 py-2 sm:px-10 sm:py-2 hover:from-amber-600 hover:to-amber-700 bg-gradient-to-r from-amber-500 to-amber-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/80"
                >
                  <p className="text-center text-xs sm:text-sm font-medium leading-snug max-w-4xl [text-wrap:pretty]">
                    {formatCelebrateBannerFromConfig(celebration)}
                  </p>
                  <span className="mt-0.5 text-[10px] text-amber-100/90">탭하여 접수 상세 열기</span>
                </button>
              ) : (
                <div
                  role="status"
                  aria-live="polite"
                  className="flex items-center justify-center px-8 py-2 sm:px-10 sm:py-2"
                >
                  <p className="text-center text-xs sm:text-sm font-medium leading-snug max-w-4xl [text-wrap:pretty]">
                    {formatCelebrateBannerFromConfig(celebration)}
                  </p>
                </div>
              )}
              <button
                type="button"
                aria-label="닫기"
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
                className="flex w-full flex-col items-center justify-center bg-gradient-to-r from-red-600 to-red-700 px-8 py-2 hover:from-red-700 hover:to-red-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/80 sm:px-10 sm:py-2"
              >
                <p className="max-w-4xl text-center text-xs font-semibold leading-snug [text-wrap:pretty] sm:text-sm">
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
                </p>
                <span className="mt-0.5 text-[10px] text-red-100/90">탭하여 문의내역 열기</span>
              </button>
              <button
                type="button"
                aria-label="닫기"
                onClick={closeLandingContactStrip}
                className="absolute right-1.5 top-1/2 flex h-8 w-8 shrink-0 -translate-y-1/2 items-center justify-center rounded-md text-white hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
                  <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <header className="px-4 py-2.5 shadow-md theme-dark-header">
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col gap-2 min-w-0">
          <div className="md:hidden flex items-center justify-between gap-2 min-w-0">
            <button
              type="button"
              onClick={() => navigate('/admin/dashboard')}
              className="min-w-0 shrink-0 text-left hover:opacity-90 transition-opacity"
              aria-label="청소비서 — 대시보드로 이동"
              title="대시보드로 이동"
            >
              <TenantBrandLogo height={28} />
            </button>
            <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 shrink-0">
              {teamPreviewLink ? <AdminDevPreviewLinks adminToken={adminToken} /> : null}
              {showVolumeStatsMenu ? <AdminVolumeStatsButton adminToken={adminToken} /> : null}
              <UserProfileMenu
                token={adminToken}
                me={{ name: meName, phone: mePhone, vehicleNumber: meVehicleNumber, role: meRole }}
                loading={meProfileLoading}
                showStagingDbImport={showStagingDbImportMenu}
                onStagingDbImport={() => setStagingDbImportModalOpen(true)}
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
                onClick={() => navigate('/admin/dashboard')}
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
                              marketplaceSellerPendingCount > 0 ||
                              marketplaceBuyerPendingCount > 0
                                ? `${def.label}, 장바구니 ${marketplaceDraftCount}건${
                                    marketplaceSellerPendingCount > 0
                                      ? `, 인계 대기 ${marketplaceSellerPendingCount}건`
                                      : ''
                                  }${
                                    marketplaceBuyerPendingCount > 0
                                      ? `, 구매 대기 ${marketplaceBuyerPendingCount}건`
                                      : ''
                                  }`
                                : def.label
                            }
                          >
                            <AdminGnbItemContent id={id} label={def.label} />
                          </NavLink>
                          {marketplaceSellerPendingCount > 0 ? (
                            <Link
                              to="/admin/db-marketplace?tab=pending"
                              className="-ml-2 inline-flex min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-amber-400 px-1.5 py-0.5 text-center text-[clamp(0.55rem,1.2vw,0.75rem)] font-bold leading-none text-slate-950 tabular-nums motion-safe:animate-pulse motion-reduce:animate-none sm:-ml-3 hover:bg-amber-300"
                              aria-label={`인계 대기 ${marketplaceSellerPendingCount}건`}
                              title="인계 대기 — 진행 중 탭"
                            >
                              {marketplaceSellerPendingCount > 99 ? '99+' : marketplaceSellerPendingCount}
                            </Link>
                          ) : null}
                          {marketplaceBuyerPendingCount > 0 ? (
                            <Link
                              to="/admin/db-marketplace?tab=pending"
                              className="-ml-2 inline-flex min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-sky-400 px-1.5 py-0.5 text-center text-[clamp(0.55rem,1.2vw,0.75rem)] font-bold leading-none text-slate-950 tabular-nums sm:-ml-3 hover:bg-sky-300"
                              aria-label={`구매 신청 대기 ${marketplaceBuyerPendingCount}건`}
                              title="구매 신청 대기 — 진행 중 탭"
                            >
                              {marketplaceBuyerPendingCount > 99 ? '99+' : marketplaceBuyerPendingCount}
                            </Link>
                          ) : null}
                          {marketplaceDraftCount > 0 ? (
                            <Link
                              to="/admin/db-marketplace?tab=cart"
                              className="-ml-2 inline-flex min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-violet-400 px-1.5 py-0.5 text-center text-[clamp(0.55rem,1.2vw,0.75rem)] font-bold leading-none text-slate-950 tabular-nums sm:-ml-3 hover:bg-violet-300"
                              aria-label={`장바구니 ${marketplaceDraftCount}건`}
                              title="장바구니 — 내 판매 탭"
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
            <UserProfileMenu
              token={adminToken}
              me={{ name: meName, phone: mePhone, vehicleNumber: meVehicleNumber, role: meRole }}
              loading={meProfileLoading}
              showStagingDbImport={showStagingDbImportMenu}
              onStagingDbImport={() => setStagingDbImportModalOpen(true)}
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
      <main className="staff-app-surface relative z-10 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-6 min-w-0 flex-1 flex flex-col min-h-0 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
        {isPlatformSupportAccess ? (
          <div className="mb-4 rounded-lg border border-violet-300 bg-violet-50 px-4 py-2.5 text-sm text-violet-900">
            플랫폼 <strong className="font-semibold">지원 접속</strong> 모드입니다. 장애 확인·복구 목적으로만
            사용하고, 작업 후 로그아웃해 주세요.
          </div>
        ) : null}
        <TenantCapabilitiesProvider value={{ features: tenantFeatures, plan: tenantPlan, tenantSlug }}>
          <AdminStaffSessionProvider
            value={{
              ready: !meProfileLoading && Boolean(meRole),
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
              <Outlet />
            </AdminStaffPathGate>
          </AdminStaffSessionProvider>
        </TenantCapabilitiesProvider>
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
        onClose={closeBillingDunning}
      />
      {adminToken && (
        <ChangeLogBell
          token={adminToken}
          fetchUnseen={getUnseenChangeCount}
          fetchList={(t, opts) => getChangeHistoryList(t, opts)}
          markSeen={markChangeSeen}
          onOpenInquiry={(inquiryId) =>
            navigate(`/admin/inquiries?openInquiry=${encodeURIComponent(inquiryId)}`)
          }
        />
      )}
    </div>
  );
}
