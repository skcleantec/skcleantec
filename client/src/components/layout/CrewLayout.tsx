import { useState, useEffect, useCallback, useSyncExternalStore, useMemo } from 'react';
import { Outlet, useNavigate, NavLink, useLocation } from 'react-router-dom';
import { getCrewToken, subscribeCrewAuth, clearCrewToken } from '../../stores/crewAuth';
import { getCrewMe } from '../../api/crew';
import { isAuthSessionExpiredError } from '../../api/auth';
import type { CrewMeResponse } from '../../api/crew';
import { CrewUiLine, crewText, crewUiLanguageToKey } from '../../i18n/crew/crewI18n';
import type { CrewMessageId } from '../../i18n/crew/crewMessages';
import { CrewUiLanguageProvider } from '../../i18n/crew/crewUiLanguageContext';
import { isCrewGroupRosterMode } from '@shared/crewGroupSettings';
import { RosterAckBanner } from '../common/RosterAckBanner';
import { useRosterAckRealtime, type RosterAckPayload } from '../../hooks/useInboxRealtime';
import { DEV_PREVIEW_ADMIN_TOKEN_BACKUP_KEY } from '../../constants/devPreviewAuth';
import { CREW_PAGE_BG, CREW_SHELL } from '../../pages/crew/crewUi';

function CrewNavIcon({
  type,
  className,
}: {
  type: 'home' | 'schedule' | 'roster' | 'settlement' | 'settings';
  className?: string;
}) {
  if (type === 'home') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
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
  if (type === 'roster') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
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
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function pageTitleKey(pathname: string): CrewMessageId {
  if (pathname === '/crew' || pathname === '/crew/') return 'crew.layout.pageHome';
  if (pathname.startsWith('/crew/schedule')) return 'crew.layout.pageSchedule';
  if (pathname.startsWith('/crew/roster')) return 'crew.layout.pageRoster';
  if (pathname.startsWith('/crew/day-offs')) return 'crew.layout.pageDayOffs';
  if (pathname.startsWith('/crew/settlement') || pathname === '/crew/expenses') return 'crew.layout.pageSettlement';
  if (pathname.startsWith('/crew/settings')) return 'crew.layout.pageSettings';
  return 'crew.layout.titlePrefix';
}

export function CrewLayout() {
  const crewToken = useSyncExternalStore(subscribeCrewAuth, getCrewToken, () => null);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [me, setMe] = useState<CrewMeResponse | null>(null);
  const [hasAdminBackup, setHasAdminBackup] = useState(false);
  const [rosterAckBanner, setRosterAckBanner] = useState<RosterAckPayload | null>(null);

  const dismissRosterAckBanner = useCallback(() => setRosterAckBanner(null), []);

  useRosterAckRealtime(
    crewToken,
    useCallback((p) => setRosterAckBanner(p), []),
    Boolean(crewToken),
  );

  useEffect(() => {
    queueMicrotask(() => {
      try {
        setHasAdminBackup(Boolean(sessionStorage.getItem(DEV_PREVIEW_ADMIN_TOKEN_BACKUP_KEY)));
      } catch {
        setHasAdminBackup(false);
      }
    });
  }, [crewToken]);

  useEffect(() => {
    const token = getCrewToken();
    if (!token) {
      queueMicrotask(() => setMe(null));
      return;
    }
    getCrewMe(token)
      .then(setMe)
      .catch((e) => {
        setMe(null);
        if (isAuthSessionExpiredError(e)) {
          clearCrewToken();
          navigate('/login', { replace: true, state: { sessionExpired: true } });
        }
      });
  }, [crewToken, navigate]);

  const reloadMe = useCallback(async () => {
    const token = getCrewToken();
    if (!token) return;
    try {
      setMe(await getCrewMe(token));
    } catch {
      /* ignore */
    }
  }, []);

  const outletCtx: CrewLayoutContext = { me, reloadMe, hasAdminBackup, setHasAdminBackup };

  const groupMode =
    me?.group.availabilityMode ?? (me?.group.useDailyRosterOnly ? 'ROSTER' : 'DAY_OFF');
  const rosterMode = me ? isCrewGroupRosterMode(groupMode) : true;
  const showDayOffsNav =
    Boolean(me && !rosterMode && me.group.allowCrewDayOffEdit && me.crewViewerRole === 'LEADER');
  const uiLang = crewUiLanguageToKey(me?.group.crewUiLanguage);

  const titleKey = useMemo(() => pageTitleKey(pathname), [pathname]);

  const settlementTo =
    me?.crewViewerRole === 'LEADER' || me?.crewJwtSource === 'preview'
      ? '/crew/settlement'
      : '/crew/settlement?tab=expenses';

  const logout = () => {
    try {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i);
        if (k?.startsWith('crewSensitivePwd:')) sessionStorage.removeItem(k);
      }
    } catch {
      /* ignore */
    }
    try {
      sessionStorage.removeItem(DEV_PREVIEW_ADMIN_TOKEN_BACKUP_KEY);
    } catch {
      /* ignore */
    }
    setHasAdminBackup(false);
    clearCrewToken();
    navigate('/login', { replace: true });
  };

  const tabClass = ({ isActive }: { isActive: boolean }) =>
    `flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 px-1 pt-1 pb-1.5 text-[12px] font-medium transition-colors ${
      isActive ? 'text-[#1D4ED8]' : 'text-slate-500'
    }`;

  return (
    <CrewUiLanguageProvider crewUiLanguage={me?.group.crewUiLanguage}>
      <div className={`relative flex min-h-screen flex-col font-sans antialiased ${CREW_PAGE_BG}`}>
        <div className="staff-top-safe relative z-20 shrink-0">
          {rosterAckBanner ? (
            <RosterAckBanner payload={rosterAckBanner} onDismiss={dismissRosterAckBanner} />
          ) : null}
          <header className="border-b border-slate-200/80 bg-white">
            <div className={`${CREW_SHELL} flex min-h-12 items-center justify-between gap-2 px-4 py-2`}>
              <h1 className="min-w-0 flex-1 truncate text-[16px] font-semibold text-[#0F172A]">
                <CrewUiLine id={titleKey} />
              </h1>
              <button
                type="button"
                className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100"
                aria-label={crewText('crew.layout.logout', uiLang)}
                onClick={logout}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </button>
            </div>
          </header>
        </div>

        <main className={`staff-app-surface relative z-10 min-h-0 min-w-0 flex-1 overflow-y-auto ${CREW_SHELL} px-3 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] pt-3`}>
          <Outlet context={outletCtx} />
        </main>

        <nav
          className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200/80 bg-white pb-[env(safe-area-inset-bottom,0px)]"
          aria-label={crewText('crew.layout.navAriaLabel', uiLang)}
        >
          <div className={`${CREW_SHELL} flex items-stretch`}>
            <NavLink to="/crew" end className={tabClass}>
              <CrewNavIcon type="home" className="h-5 w-5" />
              <CrewUiLine id="crew.layout.navHome" />
            </NavLink>
            <NavLink to="/crew/schedule" className={tabClass}>
              <CrewNavIcon type="schedule" className="h-5 w-5" />
              <CrewUiLine id="crew.layout.navSchedule" />
            </NavLink>
            <NavLink
              to={showDayOffsNav ? '/crew/day-offs' : '/crew/roster'}
              className={() => {
                const active = showDayOffsNav
                  ? pathname.startsWith('/crew/day-offs')
                  : pathname.startsWith('/crew/roster');
                return tabClass({ isActive: active });
              }}
            >
              <CrewNavIcon type="roster" className="h-5 w-5" />
              <CrewUiLine id={showDayOffsNav ? 'crew.layout.navDayOffs' : 'crew.layout.navRoster'} />
            </NavLink>
            <NavLink
              to={settlementTo}
              className={() =>
                tabClass({
                  isActive: pathname.startsWith('/crew/settlement') || pathname === '/crew/expenses',
                })
              }
            >
              <CrewNavIcon type="settlement" className="h-5 w-5" />
              <CrewUiLine id="crew.layout.navSettlement" />
            </NavLink>
            <NavLink to="/crew/settings" className={tabClass}>
              <CrewNavIcon type="settings" className="h-5 w-5" />
              <CrewUiLine id="crew.layout.navSettings" />
            </NavLink>
          </div>
        </nav>
      </div>
    </CrewUiLanguageProvider>
  );
}

export type CrewLayoutContext = {
  me: CrewMeResponse | null;
  reloadMe: () => Promise<void>;
  hasAdminBackup?: boolean;
  setHasAdminBackup?: (v: boolean) => void;
};
