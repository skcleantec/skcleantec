import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { Outlet, useNavigate, NavLink, useLocation } from 'react-router-dom';
import { getCrewToken, subscribeCrewAuth, clearCrewToken } from '../../stores/crewAuth';
import { getCrewMe } from '../../api/crew';
import { isAuthSessionExpiredError } from '../../api/auth';
import type { CrewMeResponse } from '../../api/crew';
import { CrewBiLine, crewT } from '../../i18n/crew/crewI18n';

export function CrewLayout() {
  const crewToken = useSyncExternalStore(subscribeCrewAuth, getCrewToken, () => null);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [me, setMe] = useState<CrewMeResponse | null>(null);

  useEffect(() => {
    const token = getCrewToken();
    if (!token) {
      setMe(null);
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

  const viewerRole = me?.crewViewerRole;

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
      <header className="bg-white border-b border-gray-200 shrink-0">
        <div className="max-w-4xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-fluid-sm font-semibold text-gray-900 truncate">
              <span className="text-gray-900">{crewT('crew.layout.titlePrefix').ko}</span>{' '}
              <span>{me?.group.name ?? '…'}</span>
            </div>
            <div className="text-fluid-2xs text-gray-600 truncate">
              {crewT('crew.layout.titlePrefix').th} {me?.group.name ?? '…'}
            </div>
            <div className="text-fluid-2xs text-gray-500 mt-0.5">
              {viewerRole === 'LEADER' ? (
                <CrewBiLine id="crew.layout.roleLeader" />
              ) : (
                <CrewBiLine id="crew.layout.roleMember" />
              )}
            </div>
          </div>
          <nav className="flex flex-wrap items-center gap-2 text-fluid-xs">
            <NavLink
              to="/crew"
              end
              className={({ isActive }) =>
                `px-2 py-1 rounded ${isActive ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-100'}`
              }
            >
              <CrewBiLine id="crew.layout.navHome" />
            </NavLink>
            <NavLink
              to="/crew/schedule"
              className={({ isActive }) =>
                `px-2 py-1 rounded ${isActive ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-100'}`
              }
            >
              <CrewBiLine id="crew.layout.navSchedule" />
            </NavLink>
            <NavLink
              to="/crew/roster"
              className={() =>
                `px-2 py-1 rounded ${
                  pathname.startsWith('/crew/roster')
                    ? 'bg-gray-200 text-gray-900'
                    : 'text-gray-600 hover:bg-gray-100'
                }`
              }
            >
              <CrewBiLine id="crew.layout.navRoster" />
            </NavLink>
            <button
              type="button"
              className="px-2 py-1 rounded text-red-700 hover:bg-red-50"
              onClick={() => {
                clearCrewToken();
                navigate('/login', { replace: true });
              }}
            >
              <CrewBiLine id="crew.layout.logout" />
            </button>
          </nav>
        </div>
      </header>
      <main className="flex-1 min-h-0 min-w-0 max-w-4xl w-full mx-auto px-4 py-4 overflow-y-auto">
        <Outlet context={outletCtx} />
      </main>
    </div>
  );
}

export type CrewLayoutContext = {
  me: CrewMeResponse | null;
  reloadMe: () => Promise<void>;
};
