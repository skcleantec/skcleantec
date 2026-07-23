import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import {
  getNavFavoriteSnapshot,
  MAX_NAV_FAVORITES,
  notifyNavFavoritesChanged,
  subscribeNavFavorites,
  toggleNavFavorite,
  type NavFavoriteApp,
  type NavFavoriteStore,
} from '../utils/navFavorites';

type NavFavoritesContextValue = {
  app: NavFavoriteApp;
  tenantSlug: string | null;
  userId: string | null;
  ready: boolean;
};

const NavFavoritesContext = createContext<NavFavoritesContextValue>({
  app: 'admin',
  tenantSlug: null,
  userId: null,
  ready: false,
});

export function NavFavoritesProvider({
  app,
  tenantSlug,
  userId,
  children,
}: {
  app: NavFavoriteApp;
  tenantSlug: string | null;
  userId: string | null;
  children: ReactNode;
}) {
  const ready = Boolean(userId);
  const value = useMemo(
    () => ({ app, tenantSlug, userId, ready }),
    [app, tenantSlug, userId, ready],
  );
  return <NavFavoritesContext.Provider value={value}>{children}</NavFavoritesContext.Provider>;
}

function useNavFavoritesContext() {
  return useContext(NavFavoritesContext);
}

export function useNavFavorites() {
  const { app, tenantSlug, userId, ready } = useNavFavoritesContext();

  const store = useSyncExternalStore(
    subscribeNavFavorites,
    () => getNavFavoriteSnapshot(app, tenantSlug, userId),
    () => getNavFavoriteSnapshot(app, tenantSlug, userId),
  );

  const toggle = useCallback(
    (key: string, label: string) => {
      const result = toggleNavFavorite(app, tenantSlug, userId, key, label);
      notifyNavFavoritesChanged();
      return result;
    },
    [app, tenantSlug, userId],
  );

  const isFavorite = useCallback((key: string) => store.keys.includes(key), [store]);

  return {
    ready,
    keys: store.keys,
    labels: store.labels,
    store,
    toggle,
    isFavorite,
    max: MAX_NAV_FAVORITES,
  };
}

export type { NavFavoriteStore };
