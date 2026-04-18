import { apiErrorMessage } from './apiPrefix';

const API = '/api';

/** `/api/auth/me` 401 — 만료·JWT_SECRET 불일치·손상된 토큰 */
export class AuthSessionExpiredError extends Error {
  constructor(message = '세션이 만료되었거나 토큰이 유효하지 않습니다. 다시 로그인해 주세요.') {
    super(message);
    this.name = 'AuthSessionExpiredError';
  }
}

export function isAuthSessionExpiredError(e: unknown): e is AuthSessionExpiredError {
  return e instanceof AuthSessionExpiredError;
}

function apiUnreachableMessage(): Error {
  return new Error(
    'API 서버에 연결할 수 없습니다. 프로젝트 루트에서 npm run dev 로 서버(3000)와 클라이언트(5173)를 함께 켜 주세요. (client만 단독 실행 시 로그인 불가)'
  );
}

export async function login(email: string, password: string) {
  let res: Response;
  try {
    res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    throw apiUnreachableMessage();
  }
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: unknown };
    const msg = typeof data.error === 'string' && data.error.trim() ? data.error.trim() : null;
    throw new Error(msg ?? `로그인에 실패했습니다. (HTTP ${res.status})`);
  }
  return res.json();
}

export async function getMe(token: string) {
  let res: Response;
  try {
    res = await fetch(`${API}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw apiUnreachableMessage();
  }
  if (res.status === 401) {
    throw new AuthSessionExpiredError();
  }
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, '인증 정보를 불러올 수 없습니다.'));
  }
  return res.json();
}
