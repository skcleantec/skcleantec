import type { MarketerPermissionMap } from '@shared/marketerPermissions';
import type { AdminNavContext } from '../../constants/adminNav';
import { useAdminMobileNavFavoriteItems } from './AdminNavFavoriteGnbLinks';
import { MobileNavFavoritesAccess } from './MobileNavFavoritesFab';

type Props = {
  navCtx: AdminNavContext;
  role: string | null | undefined;
  marketerPermissions: MarketerPermissionMap | null | undefined;
  registerOpen?: (open: () => void) => void;
  inFabStack?: boolean;
};

/** AdminLayout FAB 스택 — 모바일 즐겨찾기 ★ (NavFavoritesProvider 하위) */
export function AdminMobileNavFavoritesAccess({
  navCtx,
  role,
  marketerPermissions,
  registerOpen,
  inFabStack,
}: Props) {
  const { ready, items } = useAdminMobileNavFavoriteItems(navCtx, role, marketerPermissions);
  return (
    <MobileNavFavoritesAccess
      ready={ready}
      items={items}
      registerOpen={registerOpen}
      inFabStack={inFabStack}
    />
  );
}
