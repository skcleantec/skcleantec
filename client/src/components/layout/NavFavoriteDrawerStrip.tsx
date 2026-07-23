import { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import type { MarketerPermissionMap } from '@shared/marketerPermissions';
import type { AdminNavContext } from '../../constants/adminNav';
import { useNavFavorites } from '../../hooks/useNavFavorites';
import { resolveNavFavoriteEntries } from '../../utils/resolveNavFavoriteEntry';
import { AdminSideNavIcon } from './adminSideNavIcons';
import { filterAdminNavFavorites } from './AdminNavFavoriteGnbLinks';

type Props = {
  navCtx: AdminNavContext;
  role: string | null | undefined;
  marketerPermissions: MarketerPermissionMap | null | undefined;
  onNavigate?: () => void;
  /** light drawer vs dark — 기본 light */
  variant?: 'light' | 'dark';
};

export function NavFavoriteDrawerStrip({
  navCtx,
  role,
  marketerPermissions,
  onNavigate,
  variant = 'light',
}: Props) {
  const { ready, keys, labels } = useNavFavorites();

  const entries = useMemo(() => {
    if (!ready || keys.length === 0) return [];
    const resolved = resolveNavFavoriteEntries(keys, labels);
    return filterAdminNavFavorites(resolved, navCtx, role, marketerPermissions);
  }, [ready, keys, labels, navCtx, role, marketerPermissions]);

  if (entries.length === 0) return null;

  const chipClass =
    variant === 'dark'
      ? 'inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-lg border border-amber-400/30 bg-amber-500/10 px-2.5 py-1.5 text-fluid-2xs font-semibold text-amber-100 touch-manipulation hover:bg-amber-500/20'
      : 'inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-fluid-2xs font-semibold text-amber-900 touch-manipulation hover:bg-amber-100';

  return (
    <div
      className={
        variant === 'dark'
          ? 'mb-2 border-b border-white/10 pb-2'
          : 'mb-2 border-b border-slate-100 pb-2'
      }
    >
      <p
        className={
          variant === 'dark'
            ? 'mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-amber-200/80'
            : 'mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700/80'
        }
      >
        즐겨찾기
      </p>
      <div className="flex flex-wrap gap-1.5 px-1">
        {entries.map((entry) => (
          <NavLink
            key={entry.key}
            to={entry.to}
            className={chipClass}
            onClick={onNavigate}
            title={'sectionLabel' in entry && entry.sectionLabel ? `${entry.sectionLabel} › ${entry.label}` : entry.label}
          >
            {'icon' in entry && entry.kind === 'admin-side' ? (
              <AdminSideNavIcon id={entry.icon} className="h-3.5 w-3.5 shrink-0 opacity-80" />
            ) : (
              <span className="text-amber-400" aria-hidden>
                ★
              </span>
            )}
            <span className="truncate">{entry.label}</span>
          </NavLink>
        ))}
      </div>
    </div>
  );
}
