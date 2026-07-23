/** GNB·사이드 메뉴 즐겨찾기 — 계정·업체별 localStorage */

export type NavFavoriteApp = 'admin' | 'team';

export const MAX_NAV_FAVORITES = 12;

export type NavFavoriteStore = {
  keys: string[];
  /** toggle 시점 라벨 캐시 (팀 i18n·하위 메뉴용) */
  labels: Record<string, string>;
};

const EMPTY_STORE: NavFavoriteStore = { keys: [], labels: {} };

type SnapshotCache = {
  storageKey: string;
  raw: string | null;
  store: NavFavoriteStore;
};

let snapshotCache: SnapshotCache | null = null;

function invalidateNavFavoriteSnapshotCache(): void {
  snapshotCache = null;
}

function parseNavFavoriteStore(raw: string | null): NavFavoriteStore {
  if (!raw) return EMPTY_STORE;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return EMPTY_STORE;
    const o = parsed as Record<string, unknown>;
    const keys = Array.isArray(o.keys)
      ? o.keys.filter((k): k is string => typeof k === 'string' && k.length > 0)
      : [];
    const labelsRaw = o.labels && typeof o.labels === 'object' ? (o.labels as Record<string, unknown>) : {};
    const labels: Record<string, string> = {};
    for (const [k, v] of Object.entries(labelsRaw)) {
      if (typeof v === 'string' && v.trim()) labels[k] = v.trim();
    }
    const uniqueKeys = [...new Set(keys)];
    if (uniqueKeys.length === 0 && Object.keys(labels).length === 0) return EMPTY_STORE;
    return { keys: uniqueKeys, labels };
  } catch {
    return EMPTY_STORE;
  }
}

function storageKey(app: NavFavoriteApp, tenantSlug: string | null, userId: string | null): string {
  return `sk_nav_favorites_v1:${app}:${tenantSlug ?? '_'}:${userId ?? '_'}`;
}

/** useSyncExternalStore용 — 동일 localStorage면 동일 객체 참조 유지 */
export function getNavFavoriteSnapshot(
  app: NavFavoriteApp,
  tenantSlug: string | null,
  userId: string | null,
): NavFavoriteStore {
  const key = storageKey(app, tenantSlug, userId);
  if (typeof window === 'undefined') return EMPTY_STORE;

  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    return EMPTY_STORE;
  }

  if (snapshotCache && snapshotCache.storageKey === key && snapshotCache.raw === raw) {
    return snapshotCache.store;
  }

  const store = parseNavFavoriteStore(raw);
  snapshotCache = { storageKey: key, raw, store };
  return store;
}

export function adminGnbNavKey(id: string): string {
  return `admin:gnb:${id}`;
}

export function adminSideNavKey(to: string): string {
  return `admin:side:${to}`;
}

export function teamGnbNavKey(path: string): string {
  return `team:gnb:${path}`;
}

export function loadNavFavoriteStore(
  app: NavFavoriteApp,
  tenantSlug: string | null,
  userId: string | null,
): NavFavoriteStore {
  return getNavFavoriteSnapshot(app, tenantSlug, userId);
}

export function saveNavFavoriteStore(
  app: NavFavoriteApp,
  tenantSlug: string | null,
  userId: string | null,
  store: NavFavoriteStore,
): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(app, tenantSlug, userId), JSON.stringify(store));
    invalidateNavFavoriteSnapshotCache();
  } catch {
    /* Safari 사설 모드 등 */
  }
}

export type NavFavoriteToggleResult =
  | { ok: true; added: boolean; store: NavFavoriteStore }
  | { ok: false; reason: 'max' | 'invalid'; store: NavFavoriteStore };

export function toggleNavFavorite(
  app: NavFavoriteApp,
  tenantSlug: string | null,
  userId: string | null,
  key: string,
  label: string,
): NavFavoriteToggleResult {
  const current = loadNavFavoriteStore(app, tenantSlug, userId);
  if (!key.trim()) return { ok: false, reason: 'invalid', store: current };

  const exists = current.keys.includes(key);
  if (exists) {
    const keys = current.keys.filter((k) => k !== key);
    const labels = { ...current.labels };
    delete labels[key];
    const store = { keys, labels };
    saveNavFavoriteStore(app, tenantSlug, userId, store);
    return { ok: true, added: false, store };
  }

  if (current.keys.length >= MAX_NAV_FAVORITES) {
    return { ok: false, reason: 'max', store: current };
  }

  const store: NavFavoriteStore = {
    keys: [...current.keys, key],
    labels: { ...current.labels, [key]: label.trim() || key },
  };
  saveNavFavoriteStore(app, tenantSlug, userId, store);
  return { ok: true, added: true, store };
}

const listeners = new Set<() => void>();

export function subscribeNavFavorites(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifyNavFavoritesChanged(): void {
  invalidateNavFavoriteSnapshotCache();
  for (const l of listeners) l();
}
