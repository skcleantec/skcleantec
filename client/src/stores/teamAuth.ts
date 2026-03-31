const TOKEN_KEY = 'sk_team_token';
const AUTH_CHANGE_EVENT = 'sk_team_auth';

function notifyAuthChange() {
  try {
    window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
  } catch {
    /* ignore */
  }
}

export function subscribeTeamAuth(onStoreChange: () => void) {
  const run = () => onStoreChange();
  window.addEventListener('storage', run);
  window.addEventListener(AUTH_CHANGE_EVENT, run);
  const onVis = () => {
    if (document.visibilityState === 'visible') run();
  };
  document.addEventListener('visibilitychange', onVis);
  return () => {
    window.removeEventListener('storage', run);
    window.removeEventListener(AUTH_CHANGE_EVENT, run);
    document.removeEventListener('visibilitychange', onVis);
  };
}

export function getTeamToken(): string | null {
  try {
    const fromLocal = localStorage.getItem(TOKEN_KEY);
    if (fromLocal) return fromLocal;
  } catch {
    /* ignore */
  }
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setTeamToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* ignore */
  }
  notifyAuthChange();
}

export function clearTeamToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
  notifyAuthChange();
}
