import { AuthSignupOAuthError } from './signupOAuth.errors.js';
import { assertOAuthProviderSubAvailableForSignup } from './signupOAuthIdentity.service.js';
import { signSignupOAuthToken } from './signupOAuthToken.service.js';

const KAKAO_TOKEN_URL = 'https://kauth.kakao.com/oauth/token';
const KAKAO_USER_ME_URL = 'https://kapi.kakao.com/v2/user/me';

type KakaoTokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

type KakaoUserMeResponse = {
  id?: number;
  kakao_account?: {
    email?: string;
    is_email_valid?: boolean;
    is_email_verified?: boolean;
  };
};

export function getKakaoOAuthRestApiKey(): string {
  return (
    process.env.KAKAO_OAUTH_REST_API_KEY?.trim() ||
    process.env.KAKAO_REST_API_KEY?.trim() ||
    process.env.KAKAO_MAP_REST_API_KEY?.trim() ||
    ''
  );
}

function getKakaoOAuthClientSecret(): string {
  return process.env.KAKAO_OAUTH_CLIENT_SECRET?.trim() || '';
}

export function isKakaoSignupOAuthConfigured(): boolean {
  return Boolean(getKakaoOAuthRestApiKey());
}

async function exchangeKakaoAuthorizationCode(code: string, redirectUri: string): Promise<string> {
  const clientId = getKakaoOAuthRestApiKey();
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId,
    redirect_uri: redirectUri,
    code,
  });
  const clientSecret = getKakaoOAuthClientSecret();
  if (clientSecret) {
    params.set('client_secret', clientSecret);
  }

  let res: Response;
  try {
    res = await fetch(KAKAO_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: params.toString(),
    });
  } catch {
    throw new AuthSignupOAuthError('카카오 인증 서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  }

  const data = (await res.json()) as KakaoTokenResponse;
  if (!res.ok || !data.access_token?.trim()) {
    throw new AuthSignupOAuthError(
      data.error_description?.trim() ||
        data.error?.trim() ||
        '카카오 인증에 실패했습니다. 다시 「카카오로 시작」을 눌러 주세요.',
    );
  }
  return data.access_token.trim();
}

async function fetchKakaoUserProfile(accessToken: string): Promise<{ sub: string; providerEmail: string | null }> {
  let res: Response;
  try {
    res = await fetch(`${KAKAO_USER_ME_URL}?property_keys=["kakao_account.email"]`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
    });
  } catch {
    throw new AuthSignupOAuthError('카카오 사용자 정보를 가져오지 못했습니다. 다시 시도해 주세요.');
  }

  const data = (await res.json()) as KakaoUserMeResponse & { msg?: string; code?: number };
  if (!res.ok || typeof data.id !== 'number') {
    throw new AuthSignupOAuthError(
      data.msg?.trim() || '카카오 사용자 정보를 확인할 수 없습니다. 다시 시도해 주세요.',
    );
  }

  const emailRaw = data.kakao_account?.email?.trim().toLowerCase();
  const providerEmail =
    emailRaw && data.kakao_account?.is_email_valid !== false ? emailRaw : null;

  return { sub: String(data.id), providerEmail };
}

export async function resolveKakaoOAuthCredentialsFromCode(codeRaw: string, redirectUriRaw: string) {
  if (!isKakaoSignupOAuthConfigured()) {
    throw new AuthSignupOAuthError(
      '카카오 로그인이 아직 설정되지 않았습니다. 아이디·비밀번호로 로그인해 주세요.',
      503,
    );
  }

  const code = codeRaw.trim();
  const redirectUri = redirectUriRaw.trim();
  if (!code) {
    throw new AuthSignupOAuthError('카카오 인증 정보가 없습니다. 다시 시도해 주세요.');
  }
  if (!redirectUri) {
    throw new AuthSignupOAuthError('카카오 redirect URI가 올바르지 않습니다.');
  }

  const accessToken = await exchangeKakaoAuthorizationCode(code, redirectUri);
  return fetchKakaoUserProfile(accessToken);
}

export async function verifyKakaoSignupAuthorizationCode(codeRaw: string, redirectUriRaw: string) {
  if (!isKakaoSignupOAuthConfigured()) {
    throw new AuthSignupOAuthError(
      '카카오 가입이 아직 설정되지 않았습니다. 이메일·비밀번호로 가입해 주세요.',
      503,
    );
  }

  const { sub, providerEmail } = await resolveKakaoOAuthCredentialsFromCode(codeRaw, redirectUriRaw);

  await assertOAuthProviderSubAvailableForSignup('kakao', sub);

  const signupToken = signSignupOAuthToken({
    provider: 'kakao',
    providerSub: sub,
    providerEmail,
  });

  return {
    provider: 'kakao' as const,
    providerSub: sub,
    providerEmail,
    signupToken,
  };
}
