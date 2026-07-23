import { MobileNavFavoritesAccess } from './MobileNavFavoritesFab';
import { useTeamMobileNavFavoriteItems, type TeamNavVisibility } from './TeamNavFavoriteGnbLinks';

/** TeamLayout — 모바일 우하단 고정 즐겨찾기 ★ (NavFavoritesProvider 하위) */
export function TeamMobileNavFavoritesAccess({
  teamTo,
  visibility,
}: {
  teamTo: (path: string) => string;
  visibility: TeamNavVisibility;
}) {
  const { ready, items } = useTeamMobileNavFavoriteItems(teamTo, visibility);
  return <MobileNavFavoritesAccess ready={ready} items={items} standalone />;
}
