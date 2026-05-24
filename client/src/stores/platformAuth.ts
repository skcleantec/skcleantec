const TOKEN_KEY = 'sk_platform_token';
const AUTH_CHANGE_EVENT = 'sk_platform_auth';

function notifyAuthChange() {
  try {
    window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
  } catch {
    /* ignore */
  }
}

export function subscribePlatformAuth(onStoreChange: () => void) {
  const run = () => onStoreChange();
  window.addEventListener('storage', run);
  window.addEventListener(AUTH_CHANGE_EVENT, run);
  return () => {
    window.removeEventListener('storage', run);
    window.removeEventListener(AUTH_CHANGE_EVENT, run);
  };
}

export function getPlatformToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setPlatformToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
  notifyAuthChange();
}

export function clearPlatformToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
  notifyAuthChange();
}
