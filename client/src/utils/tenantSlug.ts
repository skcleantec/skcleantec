const STORAGE_KEY = 'sk_tenant_slug';

/** placeholder·서버 기본 테넌트 참고용 — 로그인 폼 자동 입력값 아님 */
export const DEFAULT_TENANT_SLUG = 'skcleanteck';

/** @deprecated 로그인 저장은 loginCredentialsStorage 사용 */
export function loadTenantSlug(): string {
  try {
    return localStorage.getItem(STORAGE_KEY)?.trim().toLowerCase() ?? '';
  } catch {
    return '';
  }
}

/** @deprecated 로그인 저장은 loginCredentialsStorage 사용 */
export function saveTenantSlug(slug: string): void {
  try {
    const v = slug.trim().toLowerCase();
    if (v) localStorage.setItem(STORAGE_KEY, v);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* Safari 사설 모드 등 */
  }
}
