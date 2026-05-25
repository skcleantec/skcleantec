const STORAGE_KEY = 'sk_login_remember_v1';

export type SavedLoginCredentials = {
  remember: boolean;
  tenantSlug: string;
  loginId: string;
  password: string;
  crewMode: boolean;
};

export function loadSavedLoginCredentials(): SavedLoginCredentials | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedLoginCredentials>;
    if (!parsed.remember) return null;
    if (typeof parsed.loginId !== 'string' || typeof parsed.password !== 'string') return null;
    return {
      remember: true,
      tenantSlug: typeof parsed.tenantSlug === 'string' ? parsed.tenantSlug.trim().toLowerCase() : '',
      loginId: parsed.loginId,
      password: parsed.password,
      crewMode: parsed.crewMode === true,
    };
  } catch {
    return null;
  }
}

export function saveLoginCredentials(data: Omit<SavedLoginCredentials, 'remember'>): void {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        remember: true,
        tenantSlug: data.tenantSlug.trim().toLowerCase(),
        loginId: data.loginId.trim(),
        password: data.password,
        crewMode: data.crewMode,
      } satisfies SavedLoginCredentials),
    );
  } catch {
    /* Safari 사설 모드 등 */
  }
}

export function clearSavedLoginCredentials(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
