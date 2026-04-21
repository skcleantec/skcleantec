/**
 * 기본: `/api` (Vite 개발 서버가 백엔드로 프록시).
 *
 * 개발 시 `vite.config`가 `import.meta.env.VITE_INTERNAL_API_BASE`에
 * `http://127.0.0.1:<PORT>/api` 를 주입합니다(Cursor·IDE 내장 브라우저에서 프록시 실패 대비).
 * 휴대폰 등 **사설 LAN IP로 Vite에 접속**할 때는 이 PC의 127.0.0.1 이 아니므로 상대 `/api` 만 사용합니다.
 *
 * 우선순위: `VITE_API_PREFIX` > `VITE_USE_VITE_PROXY=1` 이면 `/api` > LAN 호스트면 `/api` > `VITE_INTERNAL_API_BASE` > `/api`
 */
function normalizeViteApiPrefix(raw: string): string {
  let v = raw.trim().replace(/\/$/, '');
  if (v.startsWith('/') && !v.startsWith('//')) return v;
  try {
    const u = new URL(v);
    const path = u.pathname === '' ? '/' : u.pathname;
    if (path === '/') {
      if (import.meta.env.DEV) {
        console.warn(
          '[apiPrefix] VITE_API_PREFIX에 경로가 없어 `/api`를 붙였습니다. 명시적으로 `http://호스트:포트/api` 를 권장합니다.'
        );
      }
      return `${u.origin}/api`;
    }
    return v;
  } catch {
    return '/api';
  }
}

function isPrivateLanHostname(h: string): boolean {
  return (
    /^192\.168\.\d{1,3}\.\d{1,3}$/.test(h) ||
    /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h) ||
    /^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(h)
  );
}

function resolveApiPrefix(): string {
  const raw = import.meta.env.VITE_API_PREFIX as string | undefined;
  if (raw?.trim()) {
    return normalizeViteApiPrefix(raw);
  }
  if (import.meta.env.VITE_USE_VITE_PROXY === '1' || import.meta.env.VITE_USE_VITE_PROXY === 'true') {
    return '/api';
  }
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    const h = window.location.hostname;
    if (isPrivateLanHostname(h)) {
      return '/api';
    }
  }
  const internal = import.meta.env.VITE_INTERNAL_API_BASE?.trim();
  if (import.meta.env.DEV && internal) {
    return internal.replace(/\/$/, '');
  }
  return '/api';
}

export const API_PREFIX = resolveApiPrefix();

/**
 * WebSocket — `API_PREFIX`가 절대 URL이면 같은 호스트·ws 스킴으로 `/ws` 에 연결.
 */
export function devDirectWsOrigin(): string | null {
  const api = API_PREFIX;
  if (!import.meta.env.DEV || !api.startsWith('http')) return null;
  try {
    const u = new URL(api);
    const wsProto = u.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${wsProto}//${u.host}`;
  } catch {
    return null;
  }
}

/** `fetch(\`${API}/...\`)` — `API_PREFIX`와 동일 */
export const API = API_PREFIX;

export async function apiErrorMessage(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { error?: unknown };
  const e = data.error;
  if (typeof e === 'string' && e.trim()) return e.trim();
  if (res.status === 401) return '로그인이 만료되었습니다. 다시 로그인해 주세요.';
  if (res.status === 403) return '이 기능에 접근할 권한이 없습니다.';
  return `${fallback} (HTTP ${res.status})`;
}
