const STORAGE_KEY = 'sk_tenant_slug';

export const DEFAULT_TENANT_SLUG = 'skcleanteck';

export function loadTenantSlug(): string {
  try {
    const v = localStorage.getItem(STORAGE_KEY)?.trim().toLowerCase();
    return v || DEFAULT_TENANT_SLUG;
  } catch {
    return DEFAULT_TENANT_SLUG;
  }
}

export function saveTenantSlug(slug: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, slug.trim().toLowerCase());
  } catch {
    /* Safari 사설 모드 등 */
  }
}
