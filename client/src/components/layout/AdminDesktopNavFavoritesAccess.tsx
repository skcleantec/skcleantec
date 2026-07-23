import type { MarketerPermissionMap } from '@shared/marketerPermissions';
import type { AdminNavContext } from '../../constants/adminNav';
import { useAdminMobileNavFavoriteItems } from './AdminNavFavoriteGnbLinks';
import { NavFavoritesRightRail } from './NavFavoritesRightRail';
import type { StaffDesktopDockDragHandlers } from './staffRightRailStyles';

type Props = {
  navCtx: AdminNavContext;
  role: string | null | undefined;
  marketerPermissions: MarketerPermissionMap | null | undefined;
  onChangelogMount?: (node: HTMLDivElement | null) => void;
  onDockDragChange?: (handlers: StaffDesktopDockDragHandlers | null) => void;
};

/** AdminLayout — PC 우측 GNB 독 (NavFavoritesProvider 하위) */
export function AdminDesktopNavFavoritesAccess({
  navCtx,
  role,
  marketerPermissions,
  onChangelogMount,
  onDockDragChange,
}: Props) {
  const { ready, items } = useAdminMobileNavFavoriteItems(navCtx, role, marketerPermissions);
  return (
    <NavFavoritesRightRail
      ready={ready}
      items={items}
      onChangelogMount={onChangelogMount}
      onDockDragChange={onDockDragChange}
    />
  );
}
