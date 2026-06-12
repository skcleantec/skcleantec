import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { Outlet, useNavigate, NavLink, useLocation } from 'react-router-dom';
import { getToken, clearToken } from '../../stores/auth';
import { clearTeamToken, getTeamToken, subscribeTeamAuth } from '../../stores/teamAuth';
import { getTeamMe, getTeamNavBadges, type TeamViewerMe } from '../../api/team';
import { isAuthSessionExpiredError } from '../../api/auth';
import { useVisibilityInterval } from '../../hooks/useVisibilityInterval';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useInboxRealtime, useRosterAckRealtime, type RosterAckPayload } from '../../hooks/useInboxRealtime';
import { UserProfileMenu } from '../common/UserProfileMenu';
import { RosterAckBanner } from '../common/RosterAckBanner';
import { ChangeLogBell } from '../admin/ChangeLogBell';
import {
  getTeamUnseenChangeCount,
  markTeamChangeSeen,
  getTeamChangeHistoryList,
} from '../../api/inquiryChangeLogs';
import { teamPreviewDepsKey, useTeamPreviewStaleGuard } from '../../utils/teamPreviewQuery';
import { TeamBiInline, TeamBiLine, teamT } from '../../i18n/team/teamI18n';
import { TeamMobileStaffIdCardDrawer } from '../team/TeamMobileStaffIdCardDrawer';

function teamAriaAssignNav(count: number): string {
  if (count <= 0) return teamT('team.layout.aria.assignList');
  return teamT('team.layout.aria.assignListUnread', { count: String(count) });
}

function teamAriaAssignMobile(count: number): string {
  if (count <= 0) return teamT('team.layout.aria.assignShort');
  return teamT('team.layout.aria.assignShortUnread', { count: String(count) });
}

function teamAriaCs(count: number): string {
  if (count <= 0) return teamT('team.layout.aria.csOnly');
  return teamT('team.layout.aria.csUnread', { count: String(count) });
}

function teamAriaMessages(count: number): string {
  if (count <= 0) return teamT('team.layout.aria.messagesOnly');
  return teamT('team.layout.aria.messagesUnread', { count: String(count) });
}

function TeamNavIcon({ type, className }: { type: 'dashboard' | 'assignments' | 'schedule' | 'settlement' | 'dayoffs' | 'cs' | 'messages' | 'e-contracts'; className?: string }) {
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
  const [rosterAckBanner, setRosterAckBanner] = useState<RosterAckPayload | null>(null);
  const [staffIdCardUrl, setStaffIdCardUrl] = useState<string | null>(null);
  const [hireDateIso, setHireDateIso] = useState<string | null>(null);
  const [viewerUserId, setViewerUserId] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState<string | null>(null);

  useDocumentTitle(tenantName);

  const dismissRosterAckBanner = useCallback(() => setRosterAckBanner(null), []);

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
        if (isAuthSessionExpiredError(e)) {
          clearTeamToken();
          navigate('/login', { replace: true, state: { sessionExpired: true } });
        }
      });
  }, [teamToken, navigate, location.search, capturePreviewKey, isPreviewFetchStale]);

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
    `inline-flex items-center px-3 py-1.5 text-fluid-xs font-semibold rounded-xl transition-all duration-200 hover:scale-[1.015] active:scale-[0.98] ${
      isActive
        ? 'bg-blue-600 text-white shadow-sm shadow-blue-900/20'
        : 'text-slate-300 hover:text-white hover:bg-white/10'
    }`;

  const mobileTabClass = ({ isActive }: { isActive: boolean }) =>
    `flex flex-1 min-h-[50px] min-w-0 flex-col items-center justify-center gap-0.5 py-1 px-0.5 text-center text-[10px] font-semibold leading-tight touch-manipulation transition-all duration-150 ${
      isActive ? 'text-white bg-blue-600' : 'text-slate-400 hover:text-white hover:bg-white/10'
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
  const hideTeamDayoffs = userRole === 'EXTERNAL_PARTNER' && !previewExternal;
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

  const showStaffIdCardDrawer =
    Boolean(staffIdCardUrl) && (userRole === 'TEAM_LEADER' || userRole === 'EXTERNAL_PARTNER');

  return (
    <div className="relative min-h-0 h-dvh max-h-dvh bg-[#edf0f5] flex flex-col overflow-hidden font-sans antialiased">
      {/* 배경 그라데이션 오브 (요즘 트렌드 데코) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
        {/* 좌상단 퍼플-인디고 조명 */}
        <div className="absolute -top-[20%] -left-[10%] w-[70%] h-[60%] rounded-full bg-gradient-to-br from-indigo-500/16 to-purple-500/10 blur-[100px] opacity-80" />
        {/* 우하단 블루-스카이 조명 */}
        <div className="absolute -bottom-[20%] -right-[10%] w-[70%] h-[60%] rounded-full bg-gradient-to-br from-blue-500/16 to-sky-500/10 blur-[100px] opacity-80" />
        {/* 상단 중앙 소프트 스포트라이트 */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] max-w-[800px] h-[350px] rounded-full bg-indigo-500/8 blur-[120px] opacity-80" />
      </div>
      {rosterAckBanner ? (
        <RosterAckBanner
          payload={rosterAckBanner}
          onDismiss={dismissRosterAckBanner}
          showThai={!isExternalPartner}
        />
      ) : null}
      <header className="sticky top-0 z-40 pt-[env(safe-area-inset-top)] shadow-md theme-dark-header">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <h1 className="text-lg font-semibold text-white shrink-0 min-w-0">
              {isExternalPartner ? (
                <TeamBiLine
                  id="team.layout.partnerBrand"
                  vars={{ name: previewExternalName }}
                  koClassName="text-lg font-semibold text-white"
                />
              ) : tenantName ? (
                <span className="text-lg font-semibold text-white">{tenantName}</span>
              ) : (
                <TeamBiLine id="team.layout.brand" koClassName="text-lg font-semibold text-white" />
              )}
            </h1>
            <nav className="hidden sm:flex flex-wrap items-center gap-1">
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
                  <TeamBiInline id="team.layout.nav.assignments" />
                </NavLink>
                {newAssignmentCount > 0 ? (
                  <span
                    className="-ml-3 inline-flex min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-amber-400 px-1.5 py-0.5 text-center text-xs font-bold leading-none text-slate-950 tabular-nums motion-safe:animate-pulse motion-reduce:animate-none"
                    aria-hidden
                  >
                    {newAssignmentCount > 99 ? '99+' : newAssignmentCount}
                  </span>
                ) : null}
              </div>
              <NavLink to={teamTo('/team/schedule')} className={navClass}>
                <TeamNavIcon type="schedule" className="w-4 h-4 mr-1.5 shrink-0" />
                <TeamBiInline id="team.layout.nav.schedule" />
              </NavLink>
              {isExternalPartner && (
                <NavLink to={teamTo('/team/settlement')} className={navClass}>
                  <TeamNavIcon type="settlement" className="w-4 h-4 mr-1.5 shrink-0" />
                  <TeamBiInline id="team.layout.nav.settlement" />
                </NavLink>
              )}
              {!hideTeamDayoffs && (
                <NavLink to={teamTo('/team/dayoffs')} className={navClass}>
                  <TeamNavIcon type="dayoffs" className="w-4 h-4 mr-1.5 shrink-0" />
                  <TeamBiInline id="team.layout.nav.dayoffs" />
                </NavLink>
              )}
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
                  <span
                    className="-ml-3 inline-flex min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-amber-400 px-1.5 py-0.5 text-center text-xs font-bold leading-none text-slate-950 tabular-nums motion-safe:animate-pulse motion-reduce:animate-none"
                    aria-hidden
                  >
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
                  <span
                    className="-ml-3 inline-flex min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-amber-400 px-1.5 py-0.5 text-center text-xs font-bold leading-none text-slate-950 tabular-nums motion-safe:animate-pulse motion-reduce:animate-none"
                    aria-hidden
                  >
                    {unreadCount}
                  </span>
                ) : null}
              </div>
            </nav>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
            {showAdminScreenLink ? (
              <NavLink
                to="/admin/dashboard"
                className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[clamp(0.65rem,1.5vw,0.8125rem)] font-medium text-blue-700 hover:bg-blue-100 hover:text-blue-900 whitespace-nowrap"
                title={teamT('team.layout.adminScreenTitle')}
              >
                <TeamBiInline id="team.layout.adminScreen" />
              </NavLink>
            ) : null}
            {previewExternal ? (
              <div className="inline-flex items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-[clamp(0.65rem,1.5vw,0.8125rem)] text-indigo-800 whitespace-nowrap">
                <span className="font-medium">{previewExternalName}</span>
                <span className="text-indigo-600 inline-block align-middle">
                  <TeamBiInline id="team.layout.previewExternal" />
                </span>
              </div>
            ) : (
              <>
                {previewTeamLeader ? (
                  <span
                    className="max-w-[9rem] truncate rounded border border-teal-200 bg-teal-50 px-1.5 py-0.5 text-[clamp(0.6rem,1.4vw,0.75rem)] font-medium text-teal-900 whitespace-nowrap"
                    title={userName ?? undefined}
                  >
                    {userName ? `${userName} · ` : ''}
                    <TeamBiInline id="team.layout.previewTeamLeader" />
                  </span>
                ) : null}
                <UserProfileMenu
                  token={teamToken}
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
        {/* 모바일: 상단(헤더 바로 아래) 탭 메뉴 */}
        <nav className="flex sm:hidden border-t border-gray-100 bg-white">
          <NavLink to={teamTo('/team/dashboard')} className={mobileTabClass}>
            <TeamNavIcon type="dashboard" className="w-4.5 h-4.5" />
            <span className="truncate max-w-full"><TeamBiInline id="team.layout.nav.dashboard" /></span>
          </NavLink>
          <NavLink
            to={teamTo('/team/assignments')}
            className={mobileTabClass}
            aria-label={teamAriaAssignMobile(newAssignmentCount)}
          >
            <div className="relative flex flex-col items-center justify-center">
              <TeamNavIcon type="assignments" className="w-4.5 h-4.5" />
              {newAssignmentCount > 0 ? (
                <span
                  className="absolute -top-1 -right-2 inline-flex min-w-[0.875rem] h-[0.875rem] items-center justify-center rounded-full bg-amber-400 px-0.5 text-center text-[8px] font-bold leading-none text-slate-950 tabular-nums motion-safe:animate-pulse"
                >
                  {newAssignmentCount > 99 ? '99+' : newAssignmentCount}
                </span>
              ) : null}
            </div>
            <span className="truncate max-w-full"><TeamBiInline id="team.layout.nav.assignmentsShort" /></span>
          </NavLink>
          <NavLink to={teamTo('/team/schedule')} className={mobileTabClass}>
            <TeamNavIcon type="schedule" className="w-4.5 h-4.5" />
            <span className="truncate max-w-full"><TeamBiInline id="team.layout.nav.schedule" /></span>
          </NavLink>
          {isExternalPartner && (
            <NavLink to={teamTo('/team/settlement')} className={mobileTabClass}>
              <TeamNavIcon type="settlement" className="w-4.5 h-4.5" />
              <span className="truncate max-w-full"><TeamBiInline id="team.layout.nav.settlement" /></span>
            </NavLink>
          )}
          {!hideTeamDayoffs && (
            <NavLink to={teamTo('/team/dayoffs')} className={mobileTabClass}>
              <TeamNavIcon type="dayoffs" className="w-4.5 h-4.5" />
              <span className="truncate max-w-full"><TeamBiInline id="team.layout.nav.dayoffs" /></span>
            </NavLink>
          )}
          <NavLink
            to={teamTo('/team/cs')}
            className={mobileTabClass}
            aria-label={teamAriaCs(csPendingCount)}
          >
            <div className="relative flex flex-col items-center justify-center">
              <TeamNavIcon type="cs" className="w-4.5 h-4.5" />
              {csPendingCount > 0 ? (
                <span
                  className="absolute -top-1 -right-2 inline-flex min-w-[0.875rem] h-[0.875rem] items-center justify-center rounded-full bg-amber-400 px-0.5 text-center text-[8px] font-bold leading-none text-slate-950"
                >
                  {csPendingCount}
                </span>
              ) : null}
            </div>
            <span className="truncate max-w-full"><TeamBiInline id="team.layout.nav.cs" /></span>
          </NavLink>
          <NavLink
            to={teamTo('/team/messages')}
            className={mobileTabClass}
            aria-label={teamAriaMessages(unreadCount)}
          >
            <div className="relative flex flex-col items-center justify-center">
              <TeamNavIcon type="messages" className="w-4.5 h-4.5" />
              {unreadCount > 0 ? (
                <span
                  className="absolute -top-1 -right-2 inline-flex min-w-[0.875rem] h-[0.875rem] items-center justify-center rounded-full bg-amber-400 px-0.5 text-center text-[8px] font-bold leading-none text-slate-950"
                >
                  {unreadCount}
                </span>
              ) : null}
            </div>
            <span className="truncate max-w-full"><TeamBiInline id="team.layout.nav.messages" /></span>
          </NavLink>
        </nav>
      </header>
      <main className="staff-app-surface relative z-10 flex-1 max-w-6xl w-full mx-auto px-4 py-4 sm:py-6 min-w-0 overflow-x-hidden overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch] flex flex-col min-h-0">
        <Outlet />
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
          fetchUnseen={getTeamUnseenChangeCount}
          fetchList={(t, opts) => getTeamChangeHistoryList(t, opts)}
          markSeen={markTeamChangeSeen}
          onOpenInquiry={(inquiryId) =>
            navigate(`/team/assignments?openInquiry=${encodeURIComponent(inquiryId)}`)
          }
        />
      )}
    </div>
  );
}
