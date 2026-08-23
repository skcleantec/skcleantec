import { OAuth2Client } from 'google-auth-library';
import { AuthSignupOAuthError } from './signupOAuth.errors.js';
import { assertOAuthProviderSubAvailableForSignup } from './signupOAuthIdentity.service.js';
import { signSignupOAuthToken } from './signupOAuthToken.service.js';

export function getGoogleOAuthClientId(): string {
  return process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() || '';
}

export function isGoogleSignupOAuthConfigured(): boolean {
  return Boolean(getGoogleOAuthClientId());
}

export async function verifyGoogleSignupIdToken(idTokenRaw: string) {
  const clientId = getGoogleOAuthClientId();
  if (!clientId) {
    throw new AuthSignupOAuthError(
      'Google 가입이 아직 설정되지 않았습니다. 이메일·비밀번호로 가입해 주세요.',
      503,
    );
  }

  const idToken = idTokenRaw.trim();
  if (!idToken) {
    throw new AuthSignupOAuthError('Google 인증 정보가 없습니다. 다시 시도해 주세요.');
  }

  let sub: string;
  let providerEmail: string | null = null;
  try {
    const client = new OAuth2Client(clientId);
    const ticket = await client.verifyIdToken({ idToken, audience: clientId });
    const payload = ticket.getPayload();
    if (!payload?.sub) {
      throw new AuthSignupOAuthError('Google 인증 정보를 확인할 수 없습니다.');
    }
    sub = payload.sub;
    providerEmail = payload.email?.trim().toLowerCase() || null;
  } catch (e) {
    if (e instanceof AuthSignupOAuthError) throw e;
    throw new AuthSignupOAuthError('Google 인증에 실패했습니다. 다시 시도해 주세요.');
  }

  await assertOAuthProviderSubAvailableForSignup('google', sub);

  const signupToken = signSignupOAuthToken({
    provider: 'google',
    providerSub: sub,
    providerEmail,
  });

  return {
    provider: 'google' as const,
    providerSub: sub,
    providerEmail,
    signupToken,
  };
}
