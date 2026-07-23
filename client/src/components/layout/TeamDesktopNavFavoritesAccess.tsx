import { NavFavoritesRightRail } from './NavFavoritesRightRail';
import { useTeamMobileNavFavoriteItems, type TeamNavVisibility } from './TeamNavFavoriteGnbLinks';
import type { StaffDesktopDockDragHandlers } from './staffRightRailStyles';

/** TeamLayout — PC 우측 GNB 독 (NavFavoritesProvider 하위) */
export function TeamDesktopNavFavoritesAccess({
  teamTo,
  visibility,
  onChangelogMount,
  onDockDragChange,
}: {
  teamTo: (path: string) => string;
  visibility: TeamNavVisibility;
  onChangelogMount?: (node: HTMLDivElement | null) => void;
  onDockDragChange?: (handlers: StaffDesktopDockDragHandlers | null) => void;
}) {
  const { ready, items } = useTeamMobileNavFavoriteItems(teamTo, visibility);
  return (
    <NavFavoritesRightRail
      ready={ready}
      items={items}
      onChangelogMount={onChangelogMount}
      onDockDragChange={onDockDragChange}
    />
  );
}
