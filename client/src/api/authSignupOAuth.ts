import type { AuthIdentityProvider } from '@shared/authSignup';

const API = '/api/public/auth-signup';

export const KAKAO_SIGNUP_OAUTH_STATE_KEY = 'cbiseo_signup_kakao_oauth_state';
export const KAKAO_LOGIN_OAUTH_STATE_KEY = 'cbiseo_login_kakao_oauth_state';
export const KAKAO_LINK_OAUTH_STATE_KEY = 'cbiseo_link_kakao_oauth_state';
export const KAKAO_LOGIN_OAUTH_TENANT_KEY = 'cbiseo_login_kakao_oauth_tenant';

export type GoogleSignupOAuthConfig = {
  enabled: boolean;
  clientId: string;
};

export type KakaoSignupOAuthConfig = {
  enabled: boolean;
  restApiKey: string;
};

export type SignupOAuthVerifyResult = {
  provider: AuthIdentityProvider;
  providerSub: string;
  providerEmail: string | null;
  signupToken: string;
};

export async function fetchGoogleSignupOAuthConfig(): Promise<GoogleSignupOAuthConfig> {
  const res = await fetch(`${API}/oauth/google/config`);
  const data = (await res.json()) as GoogleSignupOAuthConfig & { error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Google 가입 설정을 불러오지 못했습니다.');
  return data;
}

export async function fetchKakaoSignupOAuthConfig(): Promise<KakaoSignupOAuthConfig> {
  const res = await fetch(`${API}/oauth/kakao/config`);
  const data = (await res.json()) as KakaoSignupOAuthConfig & { error?: string };
  if (!res.ok) throw new Error(data.error ?? '카카오 가입 설정을 불러오지 못했습니다.');
  return data;
}

export async function verifyGoogleSignupIdToken(idToken: string): Promise<SignupOAuthVerifyResult> {
  const res = await fetch(`${API}/oauth/google/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  const data = (await res.json()) as SignupOAuthVerifyResult & { error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Google 인증에 실패했습니다.');
  return data;
}

/** 카카오 가입 redirect_uri — Kakao Developers·authorize 요청·verify body가 동일해야 함 */
export function getSignupKakaoRedirectUri(): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/signup`;
}

/** 카카오 로그인 redirect_uri */
export function getLoginKakaoRedirectUri(): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/login`;
}

/** 기존 ADMIN 계정 카카오 연결 redirect_uri */
export function getLinkKakaoRedirectUri(): string {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/admin/account/kakao-link`;
}

export function buildKakaoSignupAuthorizeUrl(restApiKey: string, state: string): string {
  return buildKakaoAuthorizeUrl(restApiKey, state, getSignupKakaoRedirectUri());
}

export function buildKakaoLoginAuthorizeUrl(restApiKey: string, state: string): string {
  return buildKakaoAuthorizeUrl(restApiKey, state, getLoginKakaoRedirectUri());
}

export function buildKakaoLinkAuthorizeUrl(restApiKey: string, state: string): string {
  return buildKakaoAuthorizeUrl(restApiKey, state, getLinkKakaoRedirectUri());
}

function buildKakaoAuthorizeUrl(restApiKey: string, state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: restApiKey,
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
  });
  return `https://kauth.kakao.com/oauth/authorize?${params.toString()}`;
}

export async function verifyKakaoSignupAuthorizationCode(
  code: string,
  redirectUri: string,
): Promise<SignupOAuthVerifyResult> {
  const res = await fetch(`${API}/oauth/kakao/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, redirectUri }),
  });
  const data = (await res.json()) as SignupOAuthVerifyResult & { error?: string };
  if (!res.ok) throw new Error(data.error ?? '카카오 인증에 실패했습니다.');
  return data;
}
