import { API } from './apiPrefix';
import { isLikelyNetworkFailure } from './fetchNetwork';
import { AuthSessionExpiredError, invalidateAuthMeCache } from './auth';

export type OAuthIdentityItem = {
  provider: 'google' | 'kakao';
  providerEmail: string | null;
  linkedAt: string;
};

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

type OAuthApiErrorBody = { error?: string; code?: string };

function throwIfOAuthTokenExpired(res: Response, data: OAuthApiErrorBody): void {
  if (res.status === 401 && data.code === 'token_expired') {
    throw new AuthSessionExpiredError();
  }
}

export async function fetchOAuthIdentities(token: string): Promise<OAuthIdentityItem[]> {
  let res: Response;
  try {
    res = await fetch(`${API}/auth/oauth/identities`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (e) {
    if (isLikelyNetworkFailure(e)) {
      throw new Error('API 서버에 연결할 수 없습니다.');
    }
    throw e instanceof Error ? e : new Error(String(e));
  }
  const data = (await res.json()) as { items?: OAuthIdentityItem[]; code?: string; error?: string };
  throwIfOAuthTokenExpired(res, data);
  if (!res.ok) {
    throw new Error(data.error ?? '연결 상태를 불러오지 못했습니다.');
  }
  return Array.isArray(data.items) ? data.items : [];
}

export async function linkKakaoOAuthAccount(
  token: string,
  body: { code: string; redirectUri: string; password: string },
): Promise<{ provider: 'kakao'; providerEmail: string | null; linkedAt: string }> {
  let res: Response;
  try {
    res = await fetch(`${API}/auth/oauth/kakao/link`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(body),
    });
  } catch (e) {
    if (isLikelyNetworkFailure(e)) {
      throw new Error('API 서버에 연결할 수 없습니다.');
    }
    throw e instanceof Error ? e : new Error(String(e));
  }
  const data = (await res.json()) as {
    error?: string;
    code?: string;
    provider?: 'kakao';
    providerEmail?: string | null;
    linkedAt?: string;
  };
  throwIfOAuthTokenExpired(res, data);
  if (!res.ok) {
    throw new Error(data.error ?? '카카오 계정 연결에 실패했습니다.');
  }
  invalidateAuthMeCache(token);
  return {
    provider: 'kakao',
    providerEmail: data.providerEmail ?? null,
    linkedAt: data.linkedAt ?? new Date().toISOString(),
  };
}

export async function unlinkKakaoOAuthAccount(token: string, password: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API}/auth/oauth/kakao/unlink`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ password }),
    });
  } catch (e) {
    if (isLikelyNetworkFailure(e)) {
      throw new Error('API 서버에 연결할 수 없습니다.');
    }
    throw e instanceof Error ? e : new Error(String(e));
  }
  const data = (await res.json()) as OAuthApiErrorBody;
  throwIfOAuthTokenExpired(res, data);
  if (!res.ok) {
    throw new Error(data.error ?? '카카오 연결 해제에 실패했습니다.');
  }
  invalidateAuthMeCache(token);
}
