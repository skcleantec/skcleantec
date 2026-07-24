import { useState, useEffect, useCallback, useMemo, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { Outlet, useNavigate, NavLink, Link, useLocation } from 'react-router-dom';
import { getToken, clearToken } from '../../stores/auth';
import { clearTeamToken, getTeamToken, subscribeTeamAuth } from '../../stores/teamAuth';
import { getTeamMe, getTeamNavBadges, type TeamViewerMe } from '../../api/team';
import { isAuthSessionExpiredError } from '../../api/auth';
import { useVisibilityInterval } from '../../hooks/useVisibilityInterval';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useInboxRealtime, useRosterAckRealtime, useDbMarketplaceHandoffConfirmedRealtime, type RosterAckPayload, type DbMarketplaceHandoffConfirmedRtPayload } from '../../hooks/useInboxRealtime';
import { UserProfileMenu } from '../common/UserProfileMenu';
import {
  ProfileOnboardingModal,
  type ProfileOnboardingInitial,
} from '../common/ProfileOnboardingModal';
import { RosterAckBanner } from '../common/RosterAckBanner';
import { ChangeLogBell } from '../admin/ChangeLogBell';
import {
  getTeamUnseenChangeCount,
  markTeamChangeSeen,
  getTeamChangeHistoryList,
} from '../../api/inquiryChangeLogs';
import { teamPreviewDepsKey, teamProfileOnboardingRequired, useTeamPreviewStaleGuard } from '../../utils/teamPreviewQuery';
import { TeamBiInline, teamT } from '../../i18n/team/teamI18n';
import { TeamMobileStaffIdCardDrawer } from '../team/TeamMobileStaffIdCardDrawer';
import { TenantBrandLogo } from '../brand/TenantBrandLogo';
import { TenantCapabilitiesProvider } from '../../hooks/useTenantCapabilities';
import { hasFeature } from '@shared/tenantFeatureModules';
import { fetchTeamLeaderTrainingMeta } from '../../api/teamLeaderTraining';
import { assignStaffHomePath, isStandalonePwa } from '../../utils/pwaStandalone';
import { usePlatformPromos, filterPromosForDesktop, filterPromosForMobile, filterPromosForTeamPath } from '../../hooks/usePlatformPromos';
import { PlatformPromoCarousel, PlatformPromoDashboardCard } from '../platformPromo/PlatformPromoDisplay';
import { NavFavoritesProvider } from '../../hooks/useNavFavorites';
import {
  TeamNavFavoriteDrawerStrip,
  type TeamNavVisibility,
} from './TeamNavFavoriteGnbLinks';
import { TeamMobileNavFavoritesAccess } from './TeamMobileNavFavoritesAccess';
import { TeamDesktopNavFavoritesAccess } from './TeamDesktopNavFavoritesAccess';
import { MOBILE_GNB_ITEM_BASE } from './mobileStaffDockStyles';
import type { StaffDesktopDockDragHandlers } from './staffRightRailStyles';

function teamAriaAssignNav(count: number): string {
  if (count <= 0) return teamT('team.layout.aria.assignList');
  return teamT('team.layout.aria.assignListUnread', { count: String(count) });
}

function teamAriaCs(count: number): string {
  if (count <= 0) return teamT('team.layout.aria.csOnly');
  return teamT('team.layout.aria.csUnread', { count: String(count) });
}

function teamAriaMessages(count: number): string {
  if (count <= 0) return teamT('team.layout.aria.messagesOnly');
  return teamT('team.layout.aria.messagesUnread', { count: String(count) });
}

const navBadgeClass =
  '-ml-3 inline-flex min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-amber-400 px-1.5 py-0.5 text-center text-xs font-bold leading-none text-slate-950 tabular-nums motion-safe:animate-pulse motion-reduce:animate-none';

const drawerNavBadgeClass =
  'inline-flex min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-amber-400 px-1.5 py-0.5 text-center text-xs font-bold leading-none text-slate-950 tabular-nums';

function TeamHamburgerIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  );
}

function TeamCloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  );
}

function TeamNavLinks({
  teamTo,
  navClass,
  isExternalPartner,
  hideTeamDayoffs,
  showDbMarketplace,
  newAssignmentCount,
  csPendingCount,
  unreadCount,
  marketplacePendingCount,
  compact,
  drawer,
  onNavigate,
}: {
  teamTo: (path: string) => string;
  navClass: ({ isActive }: { isActive: boolean }) => string;
  isExternalPartner: boolean;
  hideTeamDayoffs: boolean;
  showDbMarketplace: boolean;
  newAssignmentCount: number;
  csPendingCount: number;
  unreadCount: number;
  marketplacePendingCount: number;
  compact?: boolean;
  drawer?: boolean;
  onNavigate?: () => void;
}) {
  const wrap = (node: ReactNode, badge?: ReactNode) =>
    drawer ? (
      <div className="flex w-full min-w-0 items-center gap-2">
        {node}
        {badge ? <span className="ml-auto shrink-0">{badge}</span> : null}
      </div>
    ) : (
      <>
        {node}
        {badge}
      </>
    );

  const linkProps = onNavigate ? { onClick: onNavigate } : {};

  const assignBadge =
    newAssignmentCount > 0 ? (
      <span className={drawer ? drawerNavBadgeClass : navBadgeClass} aria-hidden>
        {newAssignmentCount > 99 ? '99+' : newAssignmentCount}
      </span>
    ) : null;

  const marketplaceBadge =
    marketplacePendingCount > 0 ? (
      <Link
        to={teamTo('/team/db-marketplace?tab=pending')}
        className={drawer ? drawerNavBadgeClass : navBadgeClass}
        aria-label={`인계 대기 ${marketplacePendingCount}건`}
        title="인계 대기 — 진행 중 탭"
        onClick={onNavigate}
      >
        {marketplacePendingCount > 99 ? '99+' : marketplacePendingCount}
      </Link>
    ) : null;

  const csBadge =
    csPendingCount > 0 ? (
      <span className={drawer ? drawerNavBadgeClass : navBadgeClass} aria-hidden>
        {csPendingCount}
      </span>
    ) : null;

  const messagesBadge =
    unreadCount > 0 ? (
      <span className={drawer ? drawerNavBadgeClass : navBadgeClass} aria-hidden>
        {unreadCount}
      </span>
    ) : null;

  if (drawer) {
    return (
      <div className="flex flex-col gap-1">
        {wrap(
          <NavLink to={teamTo('/team/dashboard')} className={navClass} {...linkProps}>
            <TeamNavIcon type="dashboard" className="mr-3 h-5 w-5 shrink-0" />
            <TeamBiInline id="team.layout.nav.dashboard" />
          </NavLink>,
        )}
        {wrap(
          <NavLink
            to={teamTo('/team/assignments')}
            className={navClass}
            aria-label={teamAriaAssignNav(newAssignmentCount)}
            {...linkProps}
          >
            <TeamNavIcon type="assignments" className="mr-3 h-5 w-5 shrink-0" />
            <TeamBiInline id="team.layout.nav.assignments" />
          </NavLink>,
          assignBadge,
        )}
        {wrap(
          <NavLink to={teamTo('/team/schedule')} className={navClass} {...linkProps}>
            <TeamNavIcon type="schedule" className="mr-3 h-5 w-5 shrink-0" />
            <TeamBiInline id="team.layout.nav.schedule" />
          </NavLink>,
        )}
        {isExternalPartner
          ? wrap(
              <NavLink to={teamTo('/team/settlement')} className={navClass} {...linkProps}>
                <TeamNavIcon type="settlement" className="mr-3 h-5 w-5 shrink-0" />
                <TeamBiInline id="team.layout.nav.settlement" />
              </NavLink>,
            )
          : null}
        {showDbMarketplace
          ? wrap(
              <NavLink to={teamTo('/team/db-marketplace')} className={navClass} {...linkProps}>
                <TeamNavIcon type="marketplace" className="mr-3 h-5 w-5 shrink-0" />
                <TeamBiInline id="team.layout.nav.marketplace" />
              </NavLink>,
              marketplaceBadge,
            )
          : null}
        {!hideTeamDayoffs
          ? wrap(
              <NavLink to={teamTo('/team/dayoffs')} className={navClass} {...linkProps}>
                <TeamNavIcon type="dayoffs" className="mr-3 h-5 w-5 shrink-0" />
                <TeamBiInline id="team.layout.nav.dayoffs" />
              </NavLink>,
            )
          : null}
        {wrap(
          <NavLink
            to={teamTo('/team/cs')}
            className={navClass}
            aria-label={teamAriaCs(csPendingCount)}
            {...linkProps}
          >
            <TeamNavIcon type="cs" className="mr-3 h-5 w-5 shrink-0" />
            <TeamBiInline id="team.layout.nav.cs" />
          </NavLink>,
          csBadge,
        )}
        {wrap(
          <NavLink
            to={teamTo('/team/messages')}
            className={navClass}
            aria-label={teamAriaMessages(unreadCount)}
            {...linkProps}
          >
            <TeamNavIcon type="messages" className="mr-3 h-5 w-5 shrink-0" />
            <TeamBiInline id="team.layout.nav.messages" />
          </NavLink>,
          messagesBadge,
        )}
      </div>
    );
  }

  return (
    <>
      <NavLink to={teamTo('/team/dashboard')} className={navClass}>
        <TeamNavIcon type="dashboard" className="w-4 h-4 mr-1.5 shrink-0" />
        <TeamBiInline id="team.layout.nav.dashboard" />
      </NavLink>
      <div className="inline-flex shrink-0 flex-nowrap items-center gap-0">
        <NavLink
          to={teamTo('/team/assignments')}
          className={navClass}
          aria-label={teamAriaAssignNav(newAssignmentCount)}
        >
          <TeamNavIcon type="assignments" className="w-4 h-4 mr-1.5 shrink-0" />
          <TeamBiInline id={compact ? 'team.layout.nav.assignmentsShort' : 'team.layout.nav.assignments'} />
        </NavLink>
        {newAssignmentCount > 0 ? (
          <span className={navBadgeClass} aria-hidden>
            {newAssignmentCount > 99 ? '99+' : newAssignmentCount}
          </span>
        ) : null}
      </div>
      <NavLink to={teamTo('/team/schedule')} className={navClass}>
        <TeamNavIcon type="schedule" className="w-4 h-4 mr-1.5 shrink-0" />
        <TeamBiInline id="team.layout.nav.schedule" />
      </NavLink>
      {isExternalPartner ? (
        <NavLink to={teamTo('/team/settlement')} className={navClass}>
          <TeamNavIcon type="settlement" className="w-4 h-4 mr-1.5 shrink-0" />
          <TeamBiInline id="team.layout.nav.settlement" />
        </NavLink>
      ) : null}
      {showDbMarketplace ? (
        <div className="inline-flex shrink-0 flex-nowrap items-center gap-0">
          <NavLink to={teamTo('/team/db-marketplace')} className={navClass}>
            <TeamNavIcon type="marketplace" className="w-4 h-4 mr-1.5 shrink-0" />
            <TeamBiInline id="team.layout.nav.marketplace" />
          </NavLink>
          {marketplacePendingCount > 0 ? (
            <Link
              to={teamTo('/team/db-marketplace?tab=pending')}
              className={navBadgeClass}
              aria-label={`인계 대기 ${marketplacePendingCount}건`}
              title="인계 대기 — 진행 중 탭"
            >
              {marketplacePendingCount > 99 ? '99+' : marketplacePendingCount}
            </Link>
          ) : null}
        </div>
      ) : null}
      {!hideTeamDayoffs ? (
        <NavLink to={teamTo('/team/dayoffs')} className={navClass}>
          <TeamNavIcon type="dayoffs" className="w-4 h-4 mr-1.5 shrink-0" />
          <TeamBiInline id="team.layout.nav.dayoffs" />
        </NavLink>
      ) : null}
      <div className="inline-flex shrink-0 flex-nowrap items-center gap-0">
        <NavLink
          to={teamTo('/team/cs')}
          className={navClass}
          aria-label={teamAriaCs(csPendingCount)}
        >
          <TeamNavIcon type="cs" className="w-4 h-4 mr-1.5 shrink-0" />
          <TeamBiInline id="team.layout.nav.cs" />
        </NavLink>
        {csPendingCount > 0 ? (
          <span className={navBadgeClass} aria-hidden>
            {csPendingCount}
          </span>
        ) : null}
      </div>
      <div className="inline-flex shrink-0 flex-nowrap items-center gap-0">
        <NavLink
          to={teamTo('/team/messages')}
          className={navClass}
          aria-label={teamAriaMessages(unreadCount)}
        >
          <TeamNavIcon type="messages" className="w-4 h-4 mr-1.5 shrink-0" />
          <TeamBiInline id="team.layout.nav.messages" />
        </NavLink>
        {unreadCount > 0 ? (
          <span className={navBadgeClass} aria-hidden>
            {unreadCount}
          </span>
        ) : null}
      </div>
    </>
  );
}

function TeamNavIcon({ type, className }: { type: 'dashboard' | 'assignments' | 'schedule' | 'settlement' | 'marketplace' | 'dayoffs' | 'cs' | 'messages' | 'e-contracts'; className?: string }) {
  if (type === 'dashboard') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </svg>
    );
  }
  if (type === 'assignments') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        <path d="M12 11v6" />
        <path d="M9 14h6" />
      </svg>
    );
  }
  if (type === 'schedule') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    );
  }
  if (type === 'settlement') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    );
  }
  if (type === 'marketplace') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
    );
  }
  if (type === 'dayoffs') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M16 2v4M8 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
        <path d="m3 22 18-18" />
      </svg>
    );
  }
  if (type === 'cs') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    );
  }
  if (type === 'messages') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
    );
  }
  if (type === 'e-contracts') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <path d="M16 13a2 2 0 0 1-2 2H8v-4h6a2 2 0 0 1 2 2z" />
      </svg>
    );
  }
  return null;
}

export function TeamLayout() {
  const teamToken = useSyncExternalStore(subscribeTeamAuth, getTeamToken, () => null);
  const navigate = useNavigate();
  const location = useLocation();
  const previewKey = teamPreviewDepsKey(location.search);
  const { capturePreviewKey, isPreviewFetchStale } = useTeamPreviewStaleGuard(previewKey);
  const [userName, setUserName] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userPhone, setUserPhone] = useState<string | null>(null);
  const [userVehicleNumber, setUserVehicleNumber] = useState<string | null>(null);
  const [userNameEn, setUserNameEn] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [csPendingCount, setCsPendingCount] = useState(0);
  const [newAssignmentCount, setNewAssignmentCount] = useState(0);
  const [eContractPendingCount, setEContractPendingCount] = useState(0);
  const [marketplacePendingCount, setMarketplacePendingCount] = useState(0);
  const [rosterAckBanner, setRosterAckBanner] = useState<RosterAckPayload | null>(null);
  const [staffIdCardUrl, setStaffIdCardUrl] = useState<string | null>(null);
  const [hireDateIso, setHireDateIso] = useState<string | null>(null);
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState<string | null>(null);
  const [tenantFeatures, setTenantFeatures] = useState<readonly string[] | null>(null);
  const [tenantSlug, setTenantSlug] = useState<string | null>(null);
  const [teamTrainingAvailable, setTeamTrainingAvailable] = useState(false);
  const [profileOnboardingRequired, setProfileOnboardingRequired] = useState(false);
  const [profileOnboardingInitial, setProfileOnboardingInitial] = useState<ProfileOnboardingInitial>({
    role: 'TEAM_LEADER',
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [changelogRailMount, setChangelogRailMount] = useState<HTMLDivElement | null>(null);
  const [desktopDockDrag, setDesktopDockDrag] = useState<StaffDesktopDockDragHandlers | null>(null);

  const reloadTeamMe = useCallback(() => {
    const token = getTeamToken();
    if (!token) return;
    getTeamMe(token)
      .then((u: TeamViewerMe) => {
        setUserName(u.name ?? null);
        setUserRole(u.role ?? null);
        setUserPhone(u.phone ?? null);
        setUserVehicleNumber(u.vehicleNumber ?? null);
        setUserNameEn(u.role === 'TEAM_LEADER' ? (u.nameEn ?? null) : null);
        const needsOnboarding = teamProfileOnboardingRequired(u);
        setProfileOnboardingRequired(needsOnboarding);
        setProfileOnboardingInitial({
          role: u.role,
          name: u.name,
          phone: u.phone,
          vehicleNumber: u.vehicleNumber,
          nameEn: u.nameEn,
          externalCompany:
            u.externalCompany && 'bizNumber' in u.externalCompany
              ? u.externalCompany
              : u.externalCompany
                ? { ...u.externalCompany, bizNumber: null, phone: null, memo: null, businessRegistrationImageUrl: null }
                : null,
        });
      })
      .catch(() => {});
  }, []);

  useDocumentTitle(tenantName);

  const dismissRosterAckBanner = useCallback(() => setRosterAckBanner(null), []);

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
      navigate(`/team/assignments?openInquiry=${encodeURIComponent(inquiryId)}`);
      return;
    }
    navigate('/team/db-marketplace?tab=pending');
  }, [closeMarketplaceHandoffConfirmedStrip, marketplaceHandoffConfirmedAlert, navigate]);

  useEffect(() => {
    const token = getTeamToken();
    if (!token) {
      setUserName(null);
      setUserRole(null);
      setUserPhone(null);
      setUserVehicleNumber(null);
      setUserNameEn(null);
      setStaffIdCardUrl(null);
      setHireDateIso(null);
      setViewerUserId(null);
      setTenantName(null);
      setTenantFeatures(null);
      setTenantSlug(null);
      setTeamTrainingAvailable(false);
      setProfileOnboardingRequired(false);
      return;
    }
    const startedKey = capturePreviewKey();
    getTeamMe(token)
      .then((u: TeamViewerMe) => {
        if (isPreviewFetchStale(startedKey)) return;
        setUserName(u.name ?? null);
        setUserRole(u.role ?? null);
        setUserPhone(u.phone ?? null);
        setUserVehicleNumber(u.vehicleNumber ?? null);
        setUserNameEn(u.role === 'TEAM_LEADER' ? (u.nameEn ?? null) : null);
        setStaffIdCardUrl(u.staffIdCardUrl ?? null);
        setHireDateIso(u.hireDate ?? null);
        setViewerUserId(u.id ?? null);
        setTenantName(u.tenant?.displayName?.trim() || u.tenant?.name?.trim() || null);
        setTenantFeatures(Array.isArray(u.features) ? u.features : []);
        setTenantSlug(typeof u.tenant?.slug === 'string' ? u.tenant.slug : null);
        const needsOnboarding = teamProfileOnboardingRequired(u, location.search);
        setProfileOnboardingRequired(needsOnboarding);
        setProfileOnboardingInitial({
          role: u.role,
          name: u.name,
          phone: u.phone,
          vehicleNumber: u.vehicleNumber,
          nameEn: u.nameEn,
          externalCompany:
            u.externalCompany && 'bizNumber' in u.externalCompany
              ? (u.externalCompany as ProfileOnboardingInitial['externalCompany'])
              : u.externalCompany
                ? {
                    id: u.externalCompany.id,
                    name: u.externalCompany.name,
                    bizNumber: null,
                    phone: null,
                    memo: null,
                    businessRegistrationImageUrl: null,
                  }
                : null,
        });
      })
      .catch((e) => {
        if (isPreviewFetchStale(startedKey)) return;
        setUserName(null);
        setUserRole(null);
        setUserPhone(null);
        setUserVehicleNumber(null);
        setUserNameEn(null);
        setStaffIdCardUrl(null);
        setHireDateIso(null);
        setViewerUserId(null);
        setTenantName(null);
        setTenantFeatures(null);
        setTenantSlug(null);
        setTeamTrainingAvailable(false);
        if (isAuthSessionExpiredError(e)) {
          clearTeamToken();
          navigate('/login', { replace: true, state: { sessionExpired: true } });
        }
      });
  }, [teamToken, navigate, location.search, capturePreviewKey, isPreviewFetchStale]);

  useEffect(() => {
    const token = getTeamToken();
    if (!token || userRole !== 'TEAM_LEADER') {
      setTeamTrainingAvailable(false);
      return;
    }
    const startedKey = capturePreviewKey();
    fetchTeamLeaderTrainingMeta(token)
      .then((m) => {
        if (isPreviewFetchStale(startedKey)) return;
        setTeamTrainingAvailable(Boolean(m.available));
      })
      .catch(() => {
        if (isPreviewFetchStale(startedKey)) return;
        setTeamTrainingAvailable(false);
      });
  }, [userRole, tenantSlug, teamToken, previewKey, capturePreviewKey, isPreviewFetchStale]);

  const fetchTeamBadges = useCallback(() => {
    const token = getTeamToken();
    if (!token) return;
    const startedKey = capturePreviewKey();
    getTeamNavBadges(token)
      .then((r) => {
        if (isPreviewFetchStale(startedKey)) return;
        setUnreadCount(r.unreadCount);
        setCsPendingCount(r.csPendingCount);
        setNewAssignmentCount(r.newAssignmentCount ?? 0);
        setEContractPendingCount(r.eContractPendingCount ?? 0);
        setMarketplacePendingCount(r.marketplacePendingCount ?? 0);
      })
      .catch(() => {});
  }, [previewKey, capturePreviewKey, isPreviewFetchStale]);

  useEffect(() => {
    const token = getTeamToken();
    if (!token) return;
    (window as { __refreshUnreadCount?: () => void }).__refreshUnreadCount = fetchTeamBadges;
    (window as { __refreshCsPendingCount?: () => void }).__refreshCsPendingCount = fetchTeamBadges;
    (window as { __refreshTeamNavBadges?: () => void }).__refreshTeamNavBadges = fetchTeamBadges;
    return () => {
      delete (window as { __refreshUnreadCount?: () => void }).__refreshUnreadCount;
      delete (window as { __refreshCsPendingCount?: () => void }).__refreshCsPendingCount;
      delete (window as { __refreshTeamNavBadges?: () => void }).__refreshTeamNavBadges;
    };
  }, [fetchTeamBadges]);

  useEffect(() => {
    if (!getTeamToken()) return;
    void fetchTeamBadges();
  }, [fetchTeamBadges]);

  const { connected: navWsConnected } = useInboxRealtime(teamToken, fetchTeamBadges, Boolean(teamToken));
  useVisibilityInterval(fetchTeamBadges, navWsConnected ? 0 : 15000);

  useRosterAckRealtime(
    teamToken,
    useCallback((p) => setRosterAckBanner(p), []),
    Boolean(teamToken),
  );

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
    `${MOBILE_GNB_ITEM_BASE} ${
      isActive
        ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/20'
        : 'text-slate-300 hover:text-white hover:bg-white/10'
    }`;

  const searchParams = new URLSearchParams(location.search);
  const previewExternal = searchParams.get('previewRole') === 'external';
  const previewTeamLeader = searchParams.get('previewRole') === 'team_leader';
  const previewExternalName = (searchParams.get('previewExternalName') || '클린느').trim();
  const previewTeamLeaderId = (searchParams.get('previewTeamLeaderId') || '').trim();
  const adminJwt = getToken();
  const showAdminScreenLink = Boolean(
    adminJwt &&
      teamToken &&
      adminJwt === teamToken &&
      (previewExternal || previewTeamLeader),
  );
  const isExternalPartner = userRole === 'EXTERNAL_PARTNER' || previewExternal;
  const { items: teamPromoItems } = usePlatformPromos('team', location.search);
  const teamPromoForPage = useMemo(
    () => filterPromosForTeamPath(teamPromoItems, location.pathname),
    [teamPromoItems, location.pathname],
  );
  const teamMobilePromos = useMemo(() => filterPromosForMobile(teamPromoForPage), [teamPromoForPage]);
  const teamDesktopPromos = useMemo(() => filterPromosForDesktop(teamPromoForPage), [teamPromoForPage]);
  const hideTeamDayoffs = userRole === 'EXTERNAL_PARTNER' && !previewExternal;
  const showDbMarketplace =
    isExternalPartner && Boolean(tenantFeatures && hasFeature(tenantFeatures, 'mod_db_marketplace'));

  useDbMarketplaceHandoffConfirmedRealtime(
    teamToken,
    (p) => {
      if (p.buyerKind !== 'EXTERNAL_COMPANY') return;
      openMarketplaceHandoffConfirmedStrip(p);
      fetchTeamBadges();
    },
    Boolean(teamToken && showDbMarketplace),
  );

  let previewQuery = '';
  if (previewExternal) {
    const q = new URLSearchParams({
      previewRole: 'external',
      previewExternalName: previewExternalName,
    });
    const uid = searchParams.get('previewExternalUserId');
    if (uid) q.set('previewExternalUserId', uid);
    const cid = searchParams.get('externalCompanyId');
    if (cid) q.set('externalCompanyId', cid);
    previewQuery = `?${q.toString()}`;
  } else if (previewTeamLeader && previewTeamLeaderId) {
    previewQuery = `?previewRole=team_leader&previewTeamLeaderId=${encodeURIComponent(previewTeamLeaderId)}`;
  }
  const teamTo = (path: string) => `${path}${previewQuery}`;

  const navShared = {
    isExternalPartner,
    hideTeamDayoffs,
    showDbMarketplace,
    newAssignmentCount,
    csPendingCount,
    unreadCount,
    marketplacePendingCount,
  };

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname, location.search]);

  const drawerNavClass = ({ isActive }: { isActive: boolean }) =>
    `flex min-w-0 flex-1 items-center rounded-xl px-3 py-2.5 text-fluid-sm font-semibold touch-manipulation ${
      isActive
        ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/20'
        : 'text-slate-200 hover:bg-white/10 hover:text-white'
    }`;

  const showStaffIdCardDrawer =
    Boolean(staffIdCardUrl) && (userRole === 'TEAM_LEADER' || userRole === 'EXTERNAL_PARTNER');

  const teamNavFavoriteVisibility: TeamNavVisibility = {
    isExternalPartner,
    hideTeamDayoffs,
    showDbMarketplace,
  };

  return (
    <NavFavoritesProvider app="team" tenantSlug={tenantSlug} userId={viewerUserId}>
    <div className="relative min-h-0 h-dvh max-h-dvh bg-[#edf0f5] flex flex-col overflow-hidden font-sans antialiased">
      {/* 배경 그라데이션 오브 (요즘 트렌드 데코) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 max-lg:bg-[#edf0f5]" aria-hidden="true">
        <div className="hidden lg:block absolute -top-[20%] -left-[10%] w-[70%] h-[60%] rounded-full bg-gradient-to-br from-indigo-500/16 to-purple-500/10 blur-[100px] opacity-80" />
        <div className="hidden lg:block absolute -bottom-[20%] -right-[10%] w-[70%] h-[60%] rounded-full bg-gradient-to-br from-blue-500/16 to-sky-500/10 blur-[100px] opacity-80" />
        <div className="hidden lg:block absolute top-0 left-1/2 -translate-x-1/2 w-[80%] max-w-[800px] h-[350px] rounded-full bg-indigo-500/8 blur-[120px] opacity-80" />
      </div>
      <div className="staff-top-safe sticky top-0 z-40 shrink-0">
      {rosterAckBanner ? (
        <RosterAckBanner
          payload={rosterAckBanner}
          onDismiss={dismissRosterAckBanner}
          showThai={!isExternalPartner}
        />
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
                className="flex w-full flex-col items-center justify-center bg-gradient-to-r from-emerald-600 to-green-600 px-8 py-2 hover:from-emerald-700 hover:to-green-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/80 sm:px-10 sm:py-2.5"
              >
                <p className="max-w-4xl text-center text-xs font-semibold leading-snug [text-wrap:pretty] sm:text-sm">
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
                </p>
                <span className="mt-0.5 text-[10px] text-emerald-50/95">탭하여 배정 목록 열기</span>
              </button>
              <button
                type="button"
                aria-label="닫기"
                onClick={closeMarketplaceHandoffConfirmedStrip}
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
      <header className="shadow-md theme-dark-header">
        <div className="mx-auto flex min-w-0 max-w-6xl items-center justify-between gap-2 px-4 py-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-4">
            <button
              type="button"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-200 hover:bg-white/10 hover:text-white active:bg-white/15 touch-manipulation sm:hidden"
              aria-label={teamT('team.layout.nav.menuOpen')}
              aria-expanded={mobileNavOpen}
              onClick={() => setMobileNavOpen(true)}
            >
              <TeamHamburgerIcon className="h-5 w-5" />
            </button>
            <NavLink
              to={teamTo('/team/dashboard')}
              className="min-w-0 shrink-0 hover:opacity-90 transition-opacity"
              aria-label="청소비서 — 대시보드로 이동"
              title="대시보드로 이동"
              onClick={(e) => {
                if (!isStandalonePwa()) return;
                e.preventDefault();
                assignStaffHomePath('/team/dashboard');
              }}
            >
              <TenantBrandLogo height={32} />
            </NavLink>
            <nav className="hidden sm:flex flex-wrap items-center gap-1" aria-label="팀장 메뉴">
              <TeamNavLinks navClass={navClass} teamTo={teamTo} {...navShared} />
            </nav>
          </div>
          <div className="flex shrink-0 min-w-0 items-center gap-2 sm:gap-3">
              {showAdminScreenLink ? (
                <NavLink
                  to="/admin/dashboard"
                  className="inline-flex items-center rounded-md border border-white/20 bg-white/10 px-2 py-1 text-[clamp(0.65rem,1.5vw,0.8125rem)] font-medium text-slate-100 hover:bg-white/15 hover:text-white whitespace-nowrap"
                  title={teamT('team.layout.adminScreenTitle')}
                >
                  <TeamBiInline id="team.layout.adminScreen" />
                </NavLink>
              ) : null}
              {previewExternal ? (
                <div className="inline-flex items-center gap-2 rounded-md border border-indigo-300/40 bg-indigo-500/15 px-2 py-1 text-[clamp(0.65rem,1.5vw,0.8125rem)] text-indigo-100 whitespace-nowrap">
                  <span className="font-medium">{previewExternalName}</span>
                  <span className="text-indigo-200 inline-block align-middle">
                    <TeamBiInline id="team.layout.previewExternal" />
                  </span>
                </div>
              ) : (
                <>
                  {previewTeamLeader ? (
                    <span
                      className="max-w-[9rem] truncate rounded border border-teal-300/40 bg-teal-500/15 px-1.5 py-0.5 text-[clamp(0.6rem,1.4vw,0.75rem)] font-medium text-teal-100 whitespace-nowrap"
                      title={userName ?? undefined}
                    >
                      {userName ? `${userName} · ` : ''}
                      <TeamBiInline id="team.layout.previewTeamLeader" />
                    </span>
                  ) : null}
                  <UserProfileMenu
                    token={teamToken}
                    tenantName={tenantName}
                    teamProfileVehicleField
                    showVehicleForPreviewAdmin={Boolean(
                      (userRole === 'ADMIN' || userRole === 'MARKETER') && previewTeamLeader
                    )}
                    me={{
                      name: userName,
                      phone: userPhone,
                      vehicleNumber: userVehicleNumber,
                      role: userRole,
                      nameEn: userNameEn,
                    }}
                    onSaved={(next) => {
                      setUserName(next.name);
                      setUserPhone(next.phone);
                      setUserVehicleNumber(next.vehicleNumber);
                      if (next.nameEn !== undefined) setUserNameEn(next.nameEn);
                    }}
                    teamEContractMenu={
                      userRole === 'TEAM_LEADER'
                        ? { listHref: teamTo('/team/e-contracts'), pendingCount: eContractPendingCount }
                        : null
                    }
                    teamTrainingMenu={
                      userRole === 'TEAM_LEADER' && teamTrainingAvailable
                        ? { href: teamTo('/team/training') }
                        : null
                    }
                    onLogout={handleLogout}
                    onSessionExpired={() => {
                      clearTeamToken();
                      navigate('/login', { replace: true, state: { sessionExpired: true } });
                    }}
                  />
                </>
              )}
            </div>
        </div>
      </header>
      {mobileNavOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[45] bg-black/50 sm:hidden"
            aria-label={teamT('team.layout.nav.menuClose')}
            onClick={() => setMobileNavOpen(false)}
          />
          <aside
            className="theme-dark-header fixed inset-y-0 left-0 z-[46] flex w-[min(18rem,88vw)] flex-col border-r border-white/10 bg-slate-900 shadow-2xl sm:hidden"
            aria-label="팀장 메뉴"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <span className="text-fluid-sm font-semibold text-white">
                <TeamBiInline id="team.layout.nav.menuTitle" />
              </span>
              <button
                type="button"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-300 hover:bg-white/10 hover:text-white touch-manipulation"
                aria-label={teamT('team.layout.nav.menuClose')}
                onClick={() => setMobileNavOpen(false)}
              >
                <TeamCloseIcon className="h-5 w-5" />
              </button>
            </div>
            <nav className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain p-3">
              <TeamNavFavoriteDrawerStrip
                teamTo={teamTo}
                visibility={teamNavFavoriteVisibility}
                onNavigate={() => setMobileNavOpen(false)}
              />
              <TeamNavLinks
                navClass={drawerNavClass}
                teamTo={teamTo}
                drawer
                onNavigate={() => setMobileNavOpen(false)}
                {...navShared}
              />
            </nav>
          </aside>
        </>
      ) : null}
      </div>
      <main className="staff-app-surface relative z-10 flex-1 max-w-6xl w-full mx-auto px-3 sm:px-4 lg:px-5 lg:pr-12 py-2 sm:py-3 lg:py-4 min-w-0 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch] flex flex-col min-h-0">
        {isExternalPartner && teamMobilePromos.length > 0 ? (
          <div className="mb-2 w-full min-w-0 shrink-0 sm:mb-3 lg:hidden">
            <PlatformPromoCarousel items={teamMobilePromos} />
          </div>
        ) : null}
        {isExternalPartner && teamDesktopPromos.length > 0 ? (
          <div className="mb-3 hidden w-full min-w-0 shrink-0 sm:mb-4 lg:block">
            <PlatformPromoDashboardCard items={teamDesktopPromos} layout="banner" />
          </div>
        ) : null}
        <TenantCapabilitiesProvider value={{ features: tenantFeatures, plan: null, tenantSlug, telecrm: null }}>
          <Outlet />
        </TenantCapabilitiesProvider>
      </main>
      <TeamMobileStaffIdCardDrawer
        viewerUserId={viewerUserId}
        imageUrl={staffIdCardUrl}
        hireDateIso={hireDateIso}
        viewerName={userName}
        show={showStaffIdCardDrawer}
      />
      {teamToken && (userRole === 'TEAM_LEADER' || userRole === 'EXTERNAL_PARTNER') && (
        <ChangeLogBell
          token={teamToken}
          hideMarketerOnlyLines
          fetchUnseen={getTeamUnseenChangeCount}
          fetchList={(t, opts) => getTeamChangeHistoryList(t, opts)}
          markSeen={markTeamChangeSeen}
          onOpenInquiry={(inquiryId) =>
            navigate(`/team/assignments?openInquiry=${encodeURIComponent(inquiryId)}`)
          }
          desktopDock={
            changelogRailMount && desktopDockDrag
              ? { mountNode: changelogRailMount, ...desktopDockDrag }
              : null
          }
        />
      )}
      {teamToken && profileOnboardingRequired ? (
        <ProfileOnboardingModal
          open
          token={teamToken}
          initial={profileOnboardingInitial}
          onCompleted={() => {
            setProfileOnboardingRequired(false);
            reloadTeamMe();
          }}
          onSessionExpired={() => {
            clearTeamToken();
            navigate('/login', { replace: true, state: { sessionExpired: true } });
          }}
        />
      ) : null}
      <TeamMobileNavFavoritesAccess teamTo={teamTo} visibility={teamNavFavoriteVisibility} />
      <TeamDesktopNavFavoritesAccess
        teamTo={teamTo}
        visibility={teamNavFavoriteVisibility}
        onChangelogMount={setChangelogRailMount}
        onDockDragChange={setDesktopDockDrag}
      />
    </div>
    </NavFavoritesProvider>
  );
}
