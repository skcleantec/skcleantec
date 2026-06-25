import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { Outlet, useNavigate, NavLink, useLocation } from 'react-router-dom';
import { getCrewToken, subscribeCrewAuth, clearCrewToken } from '../../stores/crewAuth';
import { setToken } from '../../stores/auth';
import { DEV_PREVIEW_ADMIN_TOKEN_BACKUP_KEY } from '../../constants/devPreviewAuth';
import { getCrewMe } from '../../api/crew';
import { isAuthSessionExpiredError } from '../../api/auth';
import type { CrewMeResponse } from '../../api/crew';
import { CrewBiLine, crewT, CrewUiLine } from '../../i18n/crew/crewI18n';
import { CrewUiLanguageProvider } from '../../i18n/crew/crewUiLanguageContext';
import { isCrewGroupRosterMode } from '@shared/crewGroupSettings';
import { RosterAckBanner } from '../common/RosterAckBanner';
import { useRosterAckRealtime, type RosterAckPayload } from '../../hooks/useInboxRealtime';

function CrewNavIcon({ type, className }: { type: 'home' | 'schedule' | 'roster' | 'dayoffs' | 'settlement' | 'settings'; className?: string }) {
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
  if (type === 'dayoffs') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <line x1="9" y1="14" x2="15" y2="18" />
        <line x1="15" y1="14" x2="9" y2="18" />
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
  if (type === 'settings') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    );
  }
  return null;
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

  const outletCtx: CrewLayoutContext = { me, reloadMe };

  const groupMode =
    me?.group.availabilityMode ?? (me?.group.useDailyRosterOnly ? 'ROSTER' : 'DAY_OFF');
  const rosterMode = me ? isCrewGroupRosterMode(groupMode) : true;
  const showDayOffsNav =
    Boolean(me && !rosterMode && me.group.allowCrewDayOffEdit && me.crewViewerRole === 'LEADER');

  return (
    <CrewUiLanguageProvider crewUiLanguage={me?.group.crewUiLanguage}>
    <div className="relative min-h-screen bg-[#edf0f5] flex flex-col font-sans antialiased">
      {/* 배경 그라데이션 오브 (요즘 트렌드 데코) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 max-lg:bg-[#edf0f5]" aria-hidden="true">
        <div className="hidden lg:block absolute -top-[20%] -left-[10%] w-[70%] h-[60%] rounded-full bg-gradient-to-br from-indigo-500/16 to-purple-500/10 blur-[100px] opacity-80" />
        <div className="hidden lg:block absolute -bottom-[20%] -right-[10%] w-[70%] h-[60%] rounded-full bg-gradient-to-br from-blue-500/16 to-sky-500/10 blur-[100px] opacity-80" />
        <div className="hidden lg:block absolute top-0 left-1/2 -translate-x-1/2 w-[80%] max-w-[800px] h-[350px] rounded-full bg-indigo-500/8 blur-[120px] opacity-80" />
      </div>
      <div className="staff-top-safe shrink-0 relative z-20">
      {rosterAckBanner ? (
        <RosterAckBanner payload={rosterAckBanner} onDismiss={dismissRosterAckBanner} />
      ) : null}
      <header className="shadow-md theme-dark-header">
        <div className="max-w-4xl mx-auto px-4 py-2.5 flex flex-col gap-2 min-w-0">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="min-w-0 flex-1 leading-tight">
              <div className="text-fluid-sm font-semibold text-white truncate">
                <CrewUiLine id="crew.layout.titlePrefix" className="inline" />{' '}
                <span>{me?.group.name ?? '…'}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {hasAdminBackup ? (
                <button
                  type="button"
                  className="shrink-0 self-center px-2 py-1 rounded text-fluid-xs text-indigo-800 hover:bg-indigo-50 border border-transparent hover:border-indigo-100"
                  onClick={() => {
                    try {
                      const t = sessionStorage.getItem(DEV_PREVIEW_ADMIN_TOKEN_BACKUP_KEY);
                      if (t) {
                        setToken(t);
                        sessionStorage.removeItem(DEV_PREVIEW_ADMIN_TOKEN_BACKUP_KEY);
                        setHasAdminBackup(false);
                        clearCrewToken();
                        navigate('/admin/dashboard', { replace: true });
                      }
                    } catch {
                      /* ignore */
                    }
                  }}
                >
                  <CrewBiLine id="crew.layout.goAdmin" />
                </button>
              ) : null}
              <button
                type="button"
                className="shrink-0 self-center px-2 py-1 rounded text-fluid-xs text-red-700 hover:bg-red-50 border border-transparent hover:border-red-100"
                onClick={() => {
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
                }}
              >
                <CrewBiLine id="crew.layout.logout" />
              </button>
            </div>
          </div>
          <nav
            className="relative min-w-0 -mx-4 px-4 sm:mx-0 sm:px-0"
            aria-label={`${crewT('crew.layout.navAriaLabel').ko}. ${crewT('crew.layout.navAriaLabel').th}`}
          >
            <div
              className="flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto overscroll-x-contain pb-0.5 text-fluid-xs [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              <NavLink
                to="/crew"
                end
                className={({ isActive }) =>
                  `shrink-0 whitespace-nowrap px-3 py-1 text-fluid-xs font-semibold rounded-xl inline-flex items-center transition-all duration-200 hover:scale-[1.015] active:scale-[0.98] ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-sm shadow-slate-900/10'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
                  }`
                }
              >
                <CrewNavIcon type="home" className="w-4 h-4 mr-1.5 shrink-0" />
                <CrewUiLine id="crew.layout.navHome" />
              </NavLink>
              <NavLink
                to="/crew/schedule"
                className={({ isActive }) =>
                  `shrink-0 whitespace-nowrap px-3 py-1 text-fluid-xs font-semibold rounded-xl inline-flex items-center transition-all duration-200 hover:scale-[1.015] active:scale-[0.98] ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-sm shadow-slate-900/10'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
                  }`
                }
              >
                <CrewNavIcon type="schedule" className="w-4 h-4 mr-1.5 shrink-0" />
                <CrewUiLine id="crew.layout.navSchedule" />
              </NavLink>
              {rosterMode ? (
              <NavLink
                to="/crew/roster"
                className={() =>
                  `shrink-0 whitespace-nowrap px-3 py-1 text-fluid-xs font-semibold rounded-xl inline-flex items-center transition-all duration-200 hover:scale-[1.015] active:scale-[0.98] ${
                    pathname.startsWith('/crew/roster')
                      ? 'bg-slate-900 text-white shadow-sm shadow-slate-900/10'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
                  }`
                }
              >
                <CrewNavIcon type="roster" className="w-4 h-4 mr-1.5 shrink-0" />
                <CrewUiLine id="crew.layout.navRoster" />
              </NavLink>
              ) : null}
              {showDayOffsNav ? (
              <NavLink
                to="/crew/day-offs"
                className={({ isActive }) =>
                  `shrink-0 whitespace-nowrap px-3 py-1 text-fluid-xs font-semibold rounded-xl inline-flex items-center transition-all duration-200 hover:scale-[1.015] active:scale-[0.98] ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-sm shadow-slate-900/10'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
                  }`
                }
              >
                <CrewNavIcon type="dayoffs" className="w-4 h-4 mr-1.5 shrink-0" />
                <CrewUiLine id="crew.layout.navDayOffs" />
              </NavLink>
              ) : null}
              <NavLink
                to={
                  me?.crewViewerRole === 'LEADER' || me?.crewJwtSource === 'preview'
                    ? '/crew/settlement'
                    : '/crew/settlement?tab=expenses'
                }
                className={() => {
                  const settlementActive =
                    pathname.startsWith('/crew/settlement') || pathname === '/crew/expenses';
                  return `shrink-0 whitespace-nowrap px-3 py-1 text-fluid-xs font-semibold rounded-xl inline-flex items-center transition-all duration-200 hover:scale-[1.015] active:scale-[0.98] ${
                    settlementActive
                      ? 'bg-slate-900 text-white shadow-sm shadow-slate-900/10'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
                  }`;
                }}
              >
                <CrewNavIcon type="settlement" className="w-4 h-4 mr-1.5 shrink-0" />
                {me?.crewViewerRole === 'LEADER' || me?.crewJwtSource === 'preview' ? (
                  <CrewUiLine id="crew.layout.navSettlement" />
                ) : (
                  <CrewUiLine id="crew.layout.navTeamExpenses" />
                )}
              </NavLink>
              {me?.crewViewerRole === 'LEADER' ? (
                <NavLink
                  to="/crew/settings"
                  className={({ isActive }) =>
                    `shrink-0 whitespace-nowrap px-3 py-1 text-fluid-xs font-semibold rounded-xl inline-flex items-center transition-all duration-200 hover:scale-[1.015] active:scale-[0.98] ${
                      isActive
                        ? 'bg-slate-900 text-white shadow-sm shadow-slate-900/10'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
                    }`
                  }
                >
                  <CrewNavIcon type="settings" className="w-4 h-4 mr-1.5 shrink-0" />
                  <CrewUiLine id="crew.layout.navSettings" />
                </NavLink>
              ) : null}
            </div>
            <p className="mt-1 text-[10px] text-gray-400 sm:hidden px-0.5">
              <CrewUiLine id="crew.layout.navScrollHint" />
            </p>
          </nav>
        </div>
      </header>
      </div>
      <main className="staff-app-surface relative z-10 flex-1 min-h-0 min-w-0 max-w-4xl w-full mx-auto px-3 py-2.5 sm:px-4 sm:py-4 overflow-y-auto">
        <Outlet context={outletCtx} />
      </main>
    </div>
    </CrewUiLanguageProvider>
  );
}

export type CrewLayoutContext = {
  me: CrewMeResponse | null;
  reloadMe: () => Promise<void>;
};
