import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { Outlet, useNavigate, NavLink, useLocation } from 'react-router-dom';
import { getCrewToken, subscribeCrewAuth, clearCrewToken } from '../../stores/crewAuth';
import { setToken } from '../../stores/auth';
import { DEV_PREVIEW_ADMIN_TOKEN_BACKUP_KEY } from '../../constants/devPreviewAuth';
import { getCrewMe } from '../../api/crew';
import { isAuthSessionExpiredError } from '../../api/auth';
import type { CrewMeResponse } from '../../api/crew';
import { CrewBiLine, crewT } from '../../i18n/crew/crewI18n';
import { RosterAckBanner } from '../common/RosterAckBanner';
import { useRosterAckRealtime, type RosterAckPayload } from '../../hooks/useInboxRealtime';

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

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {rosterAckBanner ? (
        <RosterAckBanner payload={rosterAckBanner} onDismiss={dismissRosterAckBanner} />
      ) : null}
      <header className="bg-white border-b border-gray-200 shrink-0">
        <div className="max-w-4xl mx-auto px-4 py-3 flex flex-col gap-2 min-w-0">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="min-w-0 flex-1 leading-tight">
              <div className="text-fluid-sm font-semibold text-gray-900 truncate">
                <span className="text-gray-900">{crewT('crew.layout.titlePrefix').ko}</span>{' '}
                <span>{me?.group.name ?? '…'}</span>
              </div>
              <div className="text-fluid-2xs text-gray-600 truncate mt-px">
                {crewT('crew.layout.titlePrefix').th} {me?.group.name ?? '…'}
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
                  `shrink-0 whitespace-nowrap px-2 py-1 rounded ${
                    isActive ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-100'
                  }`
                }
              >
                <CrewBiLine id="crew.layout.navHome" />
              </NavLink>
              <NavLink
                to="/crew/schedule"
                className={({ isActive }) =>
                  `shrink-0 whitespace-nowrap px-2 py-1 rounded ${
                    isActive ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-100'
                  }`
                }
              >
                <CrewBiLine id="crew.layout.navSchedule" />
              </NavLink>
              <NavLink
                to="/crew/roster"
                className={() =>
                  `shrink-0 whitespace-nowrap px-2 py-1 rounded ${
                    pathname.startsWith('/crew/roster')
                      ? 'bg-gray-200 text-gray-900'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`
                }
              >
                <CrewBiLine id="crew.layout.navRoster" />
              </NavLink>
              <NavLink
                to={
                  me?.crewViewerRole === 'LEADER' || me?.crewJwtSource === 'preview'
                    ? '/crew/settlement'
                    : '/crew/settlement?tab=expenses'
                }
                className={() => {
                  const settlementActive =
                    pathname.startsWith('/crew/settlement') || pathname === '/crew/expenses';
                  return `shrink-0 whitespace-nowrap px-2 py-1 rounded ${
                    settlementActive ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-100'
                  }`;
                }}
              >
                {me?.crewViewerRole === 'LEADER' || me?.crewJwtSource === 'preview' ? (
                  <CrewBiLine id="crew.layout.navSettlement" />
                ) : (
                  <CrewBiLine id="crew.layout.navTeamExpenses" />
                )}
              </NavLink>
              {me?.crewViewerRole === 'LEADER' ? (
                <NavLink
                  to="/crew/settings"
                  className={({ isActive }) =>
                    `shrink-0 whitespace-nowrap px-2 py-1 rounded ${
                      isActive ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-100'
                    }`
                  }
                >
                  <CrewBiLine id="crew.layout.navSettings" />
                </NavLink>
              ) : null}
            </div>
            <p className="mt-1 text-[10px] text-gray-400 sm:hidden px-0.5">
              {crewT('crew.layout.navScrollHint').ko} · {crewT('crew.layout.navScrollHint').th}
            </p>
          </nav>
        </div>
      </header>
      <main className="flex-1 min-h-0 min-w-0 max-w-4xl w-full mx-auto px-3 py-2.5 sm:px-4 sm:py-4 overflow-y-auto">
        <Outlet context={outletCtx} />
      </main>
    </div>
  );
}

export type CrewLayoutContext = {
  me: CrewMeResponse | null;
  reloadMe: () => Promise<void>;
};
