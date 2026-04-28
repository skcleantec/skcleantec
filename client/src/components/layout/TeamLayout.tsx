import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { Outlet, useNavigate, NavLink, useLocation } from 'react-router-dom';
import { getToken, clearToken } from '../../stores/auth';
import { clearTeamToken, getTeamToken, subscribeTeamAuth } from '../../stores/teamAuth';
import { getMe, isAuthSessionExpiredError } from '../../api/auth';
import { getTeamNavBadges } from '../../api/team';
import { useVisibilityInterval } from '../../hooks/useVisibilityInterval';
import { useInboxRealtime, useRosterAckRealtime, type RosterAckPayload } from '../../hooks/useInboxRealtime';
import { UserProfileMenu } from '../common/UserProfileMenu';
import { RosterAckBanner } from '../common/RosterAckBanner';
export function TeamLayout() {
  const teamToken = useSyncExternalStore(subscribeTeamAuth, getTeamToken, () => null);
  const navigate = useNavigate();
  const location = useLocation();
  const [userName, setUserName] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userPhone, setUserPhone] = useState<string | null>(null);
  const [userVehicleNumber, setUserVehicleNumber] = useState<string | null>(null);
  const [userNameEn, setUserNameEn] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [csPendingCount, setCsPendingCount] = useState(0);
  const [newAssignmentCount, setNewAssignmentCount] = useState(0);
  const [rosterAckBanner, setRosterAckBanner] = useState<RosterAckPayload | null>(null);

  const dismissRosterAckBanner = useCallback(() => setRosterAckBanner(null), []);

  useEffect(() => {
    const token = getTeamToken();
    if (!token) {
      setUserName(null);
      setUserRole(null);
      setUserPhone(null);
      setUserVehicleNumber(null);
      setUserNameEn(null);
      return;
    }
    getMe(token)
      .then(
        (u: {
          name?: string;
          role?: string;
          email?: string | null;
          phone?: string | null;
          vehicleNumber?: string | null;
          nameEn?: string | null;
        }) => {
          setUserName(u.name ?? null);
          setUserRole(u.role ?? null);
          setUserPhone(u.phone ?? null);
          setUserVehicleNumber(u.vehicleNumber ?? null);
          setUserNameEn(u.role === 'TEAM_LEADER' ? (u.nameEn ?? null) : null);
        },
      )
      .catch((e) => {
        setUserName(null);
        setUserRole(null);
        setUserPhone(null);
        setUserVehicleNumber(null);
        setUserNameEn(null);
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
        setNewAssignmentCount(r.newAssignmentCount ?? 0);
      })
      .catch(() => {});
  }, []);

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
    `px-3 py-2 text-sm font-medium rounded ${isActive ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:text-gray-900'}`;

  const mobileTabClass = ({ isActive }: { isActive: boolean }) =>
    `flex flex-1 min-h-[44px] min-w-0 flex-row flex-nowrap items-center justify-center gap-0 py-2 px-0.5 text-center text-[11px] font-medium leading-tight touch-manipulation ${
      isActive ? 'text-blue-600 bg-blue-50' : 'text-gray-600'
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
    const cid = searchParams.get('externalCompanyId');
    if (cid) q.set('externalCompanyId', cid);
    previewQuery = `?${q.toString()}`;
  } else if (previewTeamLeader && previewTeamLeaderId) {
    previewQuery = `?previewRole=team_leader&previewTeamLeaderId=${encodeURIComponent(previewTeamLeaderId)}`;
  }
  const teamTo = (path: string) => `${path}${previewQuery}`;

  return (
    <div className="min-h-0 h-dvh max-h-dvh bg-gray-50 flex flex-col overflow-hidden">
      {rosterAckBanner ? (
        <RosterAckBanner payload={rosterAckBanner} onDismiss={dismissRosterAckBanner} />
      ) : null}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40 pt-[env(safe-area-inset-top)]">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <h1 className="text-lg font-semibold text-gray-800 shrink-0">
              {isExternalPartner ? `${previewExternalName} 협력사` : 'SK클린텍'}
            </h1>
            <nav className="hidden sm:flex flex-wrap items-center gap-1">
              <NavLink to={teamTo('/team/dashboard')} className={navClass}>
                대시보드
              </NavLink>
              <div className="inline-flex shrink-0 flex-nowrap items-center gap-0">
                <NavLink
                  to={teamTo('/team/assignments')}
                  className={navClass}
                  aria-label={newAssignmentCount > 0 ? `배정목록, 미확인 ${newAssignmentCount}건` : '배정목록'}
                >
                  배정목록
                </NavLink>
                {newAssignmentCount > 0 ? (
                  <span
                    className="-ml-3 inline-flex min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-red-500 px-1.5 py-0.5 text-center text-xs font-medium leading-none text-white tabular-nums motion-safe:animate-pulse motion-reduce:animate-none"
                    aria-hidden
                  >
                    {newAssignmentCount > 99 ? '99+' : newAssignmentCount}
                  </span>
                ) : null}
              </div>
              <NavLink to={teamTo('/team/schedule')} className={navClass}>
                스케줄
              </NavLink>
              {isExternalPartner && (
                <NavLink to={teamTo('/team/settlement')} className={navClass}>
                  정산
                </NavLink>
              )}
              {!hideTeamDayoffs && (
                <NavLink to={teamTo('/team/dayoffs')} className={navClass}>
                  휴무일
                </NavLink>
              )}
              <div className="inline-flex shrink-0 flex-nowrap items-center gap-0">
                <NavLink
                  to={teamTo('/team/cs')}
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
                  to={teamTo('/team/messages')}
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
            {showAdminScreenLink ? (
              <NavLink
                to="/admin/dashboard"
                className="inline-flex items-center rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-[clamp(0.65rem,1.5vw,0.8125rem)] font-medium text-blue-700 hover:bg-blue-100 hover:text-blue-900 whitespace-nowrap"
                title="관리자 화면으로 전환"
              >
                관리자 화면
              </NavLink>
            ) : null}
            {previewExternal ? (
              <div className="inline-flex items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-[clamp(0.65rem,1.5vw,0.8125rem)] text-indigo-800 whitespace-nowrap">
                <span className="font-medium">{previewExternalName}</span>
                <span className="text-indigo-600">타업체 프리뷰</span>
              </div>
            ) : (
              <>
                {previewTeamLeader ? (
                  <span className="hidden sm:inline rounded border border-teal-200 bg-teal-50 px-1.5 py-0.5 text-[clamp(0.6rem,1.4vw,0.75rem)] font-medium text-teal-900 whitespace-nowrap">
                    팀장 프리뷰
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
            대시보드
          </NavLink>
          <NavLink
            to={teamTo('/team/assignments')}
            className={mobileTabClass}
            aria-label={newAssignmentCount > 0 ? `배정, 미확인 ${newAssignmentCount}건` : '배정'}
          >
            <span className="shrink-0">배정</span>
            {newAssignmentCount > 0 ? (
              <span
                className="-ml-1 inline-flex min-w-[1rem] shrink-0 items-center justify-center rounded-full bg-red-500 px-1 py-0.5 text-center text-[10px] font-medium leading-none text-white tabular-nums motion-safe:animate-pulse motion-reduce:animate-none"
                aria-hidden
              >
                {newAssignmentCount > 99 ? '99+' : newAssignmentCount}
              </span>
            ) : null}
          </NavLink>
          <NavLink to={teamTo('/team/schedule')} className={mobileTabClass}>
            스케줄
          </NavLink>
          {isExternalPartner && (
            <NavLink to={teamTo('/team/settlement')} className={mobileTabClass}>
              정산
            </NavLink>
          )}
          {!hideTeamDayoffs && (
            <NavLink to={teamTo('/team/dayoffs')} className={mobileTabClass}>
              휴무일
            </NavLink>
          )}
          <NavLink
            to={teamTo('/team/cs')}
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
            to={teamTo('/team/messages')}
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
