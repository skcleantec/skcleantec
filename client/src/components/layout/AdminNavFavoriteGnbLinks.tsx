import { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { canAccessAdminPath } from '@shared/marketerPermissionNav';
import type { MarketerPermissionMap } from '@shared/marketerPermissions';
import { canShowAdminNavItem, type AdminNavContext } from '../../constants/adminNav';
import { useNavFavorites } from '../../hooks/useNavFavorites';
import {
  resolveNavFavoriteEntries,
  type ResolvedAdminGnbFavorite,
  type ResolvedAdminSideFavorite,
  type ResolvedNavFavorite,
} from '../../utils/resolveNavFavoriteEntry';
import { AdminSideNavIcon } from './adminSideNavIcons';
import type { MobileNavFavoriteItem } from './MobileNavFavoritesFab';

function AdminGnbFavoriteLink({
  entry,
  navClass,
}: {
  entry: ResolvedAdminGnbFavorite;
  navClass: ({ isActive }: { isActive: boolean }) => string;
}) {
  return (
    <NavLink
      to={entry.to}
      className={({ isActive }) =>
        `${navClass({ isActive })} ring-1 ring-inset ${isActive ? 'ring-amber-200/80' : 'ring-amber-400/35'}`
      }
      data-admin-gnb-favorite
      title={`즐겨찾기 · ${entry.label}`}
    >
      <span className="text-amber-300" aria-hidden>
        ★
      </span>
      <span className="whitespace-nowrap leading-none">{entry.label}</span>
    </NavLink>
  );
}

function AdminSideFavoriteLink({
  entry,
  navClass,
}: {
  entry: ResolvedAdminSideFavorite;
  navClass: ({ isActive }: { isActive: boolean }) => string;
}) {
  return (
    <NavLink
      to={entry.to}
      className={({ isActive }) =>
        `${navClass({ isActive })} ring-1 ring-inset ${isActive ? 'ring-amber-200/80' : 'ring-amber-400/35'}`
      }
      data-admin-gnb-favorite
      title={entry.sectionLabel ? `즐겨찾기 · ${entry.sectionLabel} › ${entry.label}` : `즐겨찾기 · ${entry.label}`}
    >
      <AdminSideNavIcon id={entry.icon} className="h-4 w-4 shrink-0 opacity-90" />
      <span className="whitespace-nowrap leading-none">{entry.label}</span>
    </NavLink>
  );
}

export function filterAdminNavFavorites(
  entries: ResolvedNavFavorite[],
  navCtx: AdminNavContext,
  role: string | null | undefined,
  marketerPermissions: MarketerPermissionMap | null | undefined,
): ResolvedNavFavorite[] {
  return entries.filter((entry) => {
    if (entry.kind === 'admin-gnb') {
      return canShowAdminNavItem(entry.gnbId, navCtx);
    }
    if (entry.kind === 'admin-side') {
      return canAccessAdminPath(role, marketerPermissions, entry.to);
    }
    return false;
  });
}

export function useAdminNavFavoriteEntries(
  navCtx: AdminNavContext,
  role: string | null | undefined,
  marketerPermissions: MarketerPermissionMap | null | undefined,
) {
  const { ready, keys, labels } = useNavFavorites();

  return useMemo(() => {
    if (!ready || keys.length === 0) return [];
    const resolved = resolveNavFavoriteEntries(keys, labels);
    return filterAdminNavFavorites(resolved, navCtx, role, marketerPermissions);
  }, [ready, keys, labels, navCtx, role, marketerPermissions]);
}

function adminFavoriteToMobileItem(entry: ResolvedNavFavorite): MobileNavFavoriteItem | null {
  if (entry.kind === 'admin-gnb') {
    return { key: entry.key, to: entry.to, label: entry.label };
  }
  if (entry.kind === 'admin-side') {
    return {
      key: entry.key,
      to: entry.to,
      label: entry.label,
      icon: <AdminSideNavIcon id={entry.icon} className="h-4 w-4 shrink-0 opacity-90" />,
    };
  }
  return null;
}

export function useAdminMobileNavFavoriteItems(
  navCtx: AdminNavContext,
  role: string | null | undefined,
  marketerPermissions: MarketerPermissionMap | null | undefined,
): { ready: boolean; items: MobileNavFavoriteItem[] } {
  const { ready } = useNavFavorites();
  const entries = useAdminNavFavoriteEntries(navCtx, role, marketerPermissions);
  const items = useMemo(
    () =>
      entries
        .map((entry) => adminFavoriteToMobileItem(entry))
        .filter((item): item is MobileNavFavoriteItem => item != null),
    [entries],
  );
  return { ready, items };
}

export function AdminNavFavoriteGnbLinks({
  navClass,
  navCtx,
  role,
  marketerPermissions,
}: {
  navClass: ({ isActive }: { isActive: boolean }) => string;
  navCtx: AdminNavContext;
  role: string | null | undefined;
  marketerPermissions: MarketerPermissionMap | null | undefined;
}) {
  const entries = useAdminNavFavoriteEntries(navCtx, role, marketerPermissions);

  if (entries.length === 0) return null;

  return (
    <div className="hidden lg:flex lg:flex-row lg:items-center lg:gap-1 shrink-0">
      {entries.map((entry) =>
        entry.kind === 'admin-gnb' ? (
          <AdminGnbFavoriteLink key={entry.key} entry={entry} navClass={navClass} />
        ) : entry.kind === 'admin-side' ? (
          <AdminSideFavoriteLink key={entry.key} entry={entry} navClass={navClass} />
        ) : null,
      )}
      <span className="mx-0.5 h-5 w-px shrink-0 bg-white/15" aria-hidden />
    </div>
  );
}
