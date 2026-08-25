import { MobileNavFavoritesAccess } from './MobileNavFavoritesFab';
import { useTeamMobileNavFavoriteItems, type TeamNavVisibility } from './TeamNavFavoriteGnbLinks';

/** TeamLayout — 모바일 우하단 고정 즐겨찾기 ★ (NavFavoritesProvider 하위) */
export function TeamMobileNavFavoritesAccess({
  teamTo,
  visibility,
  registerOpen,
  inFabStack,
}: {
  teamTo: (path: string) => string;
  visibility: TeamNavVisibility;
  registerOpen?: (open: () => void) => void;
  inFabStack?: boolean;
}) {
  const { ready, items } = useTeamMobileNavFavoriteItems(teamTo, visibility);
  return (
    <MobileNavFavoritesAccess
      ready={ready}
      items={items}
      registerOpen={registerOpen}
      inFabStack={inFabStack}
    />
  );
}
