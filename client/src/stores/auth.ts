const TOKEN_KEY = 'sk_admin_token';
const AUTH_CHANGE_EVENT = 'sk_admin_auth';

function notifyAuthChange() {
  try {
    window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
  } catch {
    /* ignore */
  }
}

/** ProtectedRoute 등이 토큰 변경·탭 복귀·다른 탭 storage 변경에 반응하도록 구독 */
export function subscribeAdminAuth(onStoreChange: () => void) {
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

export function getToken(): string | null {
  try {
    const fromLocal = localStorage.getItem(TOKEN_KEY);
    if (fromLocal) return fromLocal;
  } catch {
    /* Safari 사설 모드·저장소 거부 등 */
  }
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string) {
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

export function clearToken() {
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
