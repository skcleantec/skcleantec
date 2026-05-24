import { API, apiErrorMessage } from './apiPrefix';
import { isLikelyNetworkFailure } from './fetchNetwork';

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
    'API 서버에 연결할 수 없습니다. 저장소 루트 또는 client 에서 npm run dev 로 API(기본 3000)와 Vite를 함께 켜 주세요. 개발 모드는 Cursor 포함 대부분 주소에서 API에 직접 붙습니다 — server/.env 의 PORT 와 API 기동 여부를 확인하세요.'
  );
}

export async function login(tenantSlug: string, email: string, password: string) {
  let res: Response;
  try {
    res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tenantSlug, email, password }),
    });
  } catch (e) {
    if (isLikelyNetworkFailure(e)) {
      throw apiUnreachableMessage();
    }
    throw e instanceof Error ? e : new Error(String(e));
  }
  if (!res.ok) {
    if (res.status === 502 || res.status === 503) {
      throw apiUnreachableMessage();
    }
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
  } catch (e) {
    if (isLikelyNetworkFailure(e)) {
      throw apiUnreachableMessage();
    }
    throw e instanceof Error ? e : new Error(String(e));
  }
  if (res.status === 401) {
    throw new AuthSessionExpiredError();
  }
  if (!res.ok) {
    if (res.status === 502 || res.status === 503) {
      throw apiUnreachableMessage();
    }
    throw new Error(await apiErrorMessage(res, '인증 정보를 불러올 수 없습니다.'));
  }
  return res.json();
}

export async function updateMyProfile(
  token: string,
  body: {
    name?: string;
    phone?: string | null;
    vehicleNumber?: string | null;
    password?: string;
    nameEn?: string | null;
  },
) {
  let res: Response;
  try {
    res = await fetch(`${API}/auth/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    if (isLikelyNetworkFailure(e)) {
      throw apiUnreachableMessage();
    }
    throw e instanceof Error ? e : new Error(String(e));
  }
  if (res.status === 401) {
    throw new AuthSessionExpiredError();
  }
  if (!res.ok) {
    if (res.status === 502 || res.status === 503) {
      throw apiUnreachableMessage();
    }
    throw new Error(await apiErrorMessage(res, '개인정보를 수정하지 못했습니다.'));
  }
  return res.json();
}
