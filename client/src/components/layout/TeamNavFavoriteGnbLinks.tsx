import { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { useNavFavorites } from '../../hooks/useNavFavorites';
import { resolveNavFavoriteEntries, type ResolvedTeamGnbFavorite } from '../../utils/resolveNavFavoriteEntry';
import type { MobileNavFavoriteItem } from './MobileNavFavoritesFab';

function TeamNavIcon({
  type,
  className,
}: {
  type: ResolvedTeamGnbFavorite['teamIcon'];
  className?: string;
}) {
  if (type === 'dashboard') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </svg>
    );
  }
  if (type === 'assignments') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
        <path d="M12 11v6M9 14h6" />
      </svg>
    );
  }
  if (type === 'schedule') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    );
  }
  if (type === 'messages') {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </svg>
    );
  }
  return (
    <span className={`inline-block ${className ?? ''}`} aria-hidden>
      ★
    </span>
  );
}

type TeamNavVisibility = {
  isExternalPartner: boolean;
  hideTeamDayoffs: boolean;
  showDbMarketplace: boolean;
};

function filterTeamFavorites(entries: ResolvedTeamGnbFavorite[], vis: TeamNavVisibility) {
  return entries.filter((e) => {
    if (e.to === '/team/settlement' && !vis.isExternalPartner) return false;
    if (e.to === '/team/db-marketplace' && !vis.showDbMarketplace) return false;
    if (e.to === '/team/dayoffs' && vis.hideTeamDayoffs) return false;
    return true;
  });
}

export function TeamNavFavoriteGnbLinks({
  navClass,
  teamTo,
  visibility,
}: {
  navClass: ({ isActive }: { isActive: boolean }) => string;
  teamTo: (path: string) => string;
  visibility: TeamNavVisibility;
}) {
  const { ready, keys, labels } = useNavFavorites();

  const entries = useMemo(() => {
    if (!ready || keys.length === 0) return [];
    const resolved = resolveNavFavoriteEntries(keys, labels).filter(
      (e): e is ResolvedTeamGnbFavorite => e.kind === 'team-gnb',
    );
    return filterTeamFavorites(resolved, visibility);
  }, [ready, keys, labels, visibility]);

  if (entries.length === 0) return null;

  return (
    <>
      {entries.map((entry) => (
        <NavLink
          key={entry.key}
          to={teamTo(entry.to)}
          className={({ isActive }) =>
            `${navClass({ isActive })} ring-1 ring-inset ${isActive ? 'ring-amber-200/80' : 'ring-amber-400/35'}`
          }
          title={`즐겨찾기 · ${entry.label}`}
        >
          <span className="text-amber-300" aria-hidden>
            ★
          </span>
          <TeamNavIcon type={entry.teamIcon} className="h-4 w-4 shrink-0" />
          <span className="whitespace-nowrap">{entry.label}</span>
        </NavLink>
      ))}
      <span className="mx-0.5 hidden h-5 w-px shrink-0 bg-white/15 sm:inline-block" aria-hidden />
    </>
  );
}

export function TeamNavFavoriteDrawerStrip({
  teamTo,
  visibility,
  onNavigate,
}: {
  teamTo: (path: string) => string;
  visibility: TeamNavVisibility;
  onNavigate?: () => void;
}) {
  const { ready, keys, labels } = useNavFavorites();

  const entries = useMemo(() => {
    if (!ready || keys.length === 0) return [];
    const resolved = resolveNavFavoriteEntries(keys, labels).filter(
      (e): e is ResolvedTeamGnbFavorite => e.kind === 'team-gnb',
    );
    return filterTeamFavorites(resolved, visibility);
  }, [ready, keys, labels, visibility]);

  if (entries.length === 0) return null;

  return (
    <div className="mb-2 border-b border-white/10 pb-2">
      <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-amber-200/80">즐겨찾기</p>
      <div className="flex flex-wrap gap-1.5">
        {entries.map((entry) => (
          <NavLink
            key={entry.key}
            to={teamTo(entry.to)}
            onClick={onNavigate}
            className="inline-flex min-w-0 items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-500/10 px-2.5 py-1.5 text-fluid-2xs font-semibold text-amber-100 touch-manipulation hover:bg-amber-500/20"
          >
            <span className="text-amber-300" aria-hidden>
              ★
            </span>
            <span className="truncate">{entry.label}</span>
          </NavLink>
        ))}
      </div>
    </div>
  );
}

export function useTeamMobileNavFavoriteItems(
  teamTo: (path: string) => string,
  visibility: TeamNavVisibility,
): { ready: boolean; items: MobileNavFavoriteItem[] } {
  const { ready, keys, labels } = useNavFavorites();

  const items = useMemo(() => {
    if (!ready || keys.length === 0) return [];
    const resolved = resolveNavFavoriteEntries(keys, labels).filter(
      (e): e is ResolvedTeamGnbFavorite => e.kind === 'team-gnb',
    );
    return filterTeamFavorites(resolved, visibility).map((entry) => ({
      key: entry.key,
      to: teamTo(entry.to),
      label: entry.label,
    }));
  }, [ready, keys, labels, visibility, teamTo]);

  return { ready, items };
}

export type { TeamNavVisibility };
