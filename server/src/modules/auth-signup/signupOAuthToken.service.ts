import jwt from 'jsonwebtoken';
import type { AuthIdentityProvider } from '@prisma/client';
import { AuthSignupOAuthError } from './signupOAuth.errors.js';

const SIGNUP_OAUTH_TOKEN_TTL = '15m';
const TOKEN_PURPOSE = 'auth_signup_oauth';

export type SignupOAuthTokenPayload = {
  purpose: typeof TOKEN_PURPOSE;
  provider: AuthIdentityProvider;
  providerSub: string;
  providerEmail: string | null;
};

function getSignupOAuthSecret(): string {
  const secret =
    process.env.AUTH_SIGNUP_OAUTH_STATE_SECRET?.trim() || process.env.JWT_SECRET?.trim();
  if (!secret) {
    throw new AuthSignupOAuthError(
      '가입 OAuth 설정이 완료되지 않았습니다. AUTH_SIGNUP_OAUTH_STATE_SECRET 또는 JWT_SECRET을 확인해 주세요.',
      503,
    );
  }
  return secret;
}

export function signSignupOAuthToken(input: {
  provider: AuthIdentityProvider;
  providerSub: string;
  providerEmail: string | null;
}): string {
  const payload: SignupOAuthTokenPayload = {
    purpose: TOKEN_PURPOSE,
    provider: input.provider,
    providerSub: input.providerSub,
    providerEmail: input.providerEmail,
  };
  return jwt.sign(payload, getSignupOAuthSecret(), { expiresIn: SIGNUP_OAUTH_TOKEN_TTL });
}

export function verifySignupOAuthToken(raw: string): SignupOAuthTokenPayload {
  const token = raw.trim();
  if (!token) {
    throw new AuthSignupOAuthError('Google 인증이 만료되었습니다. 다시 「Google로 시작」을 눌러 주세요.');
  }
  try {
    const decoded = jwt.verify(token, getSignupOAuthSecret()) as SignupOAuthTokenPayload;
    if (decoded.purpose !== TOKEN_PURPOSE || !decoded.provider || !decoded.providerSub) {
      throw new AuthSignupOAuthError('Google 인증 정보가 올바르지 않습니다. 다시 시도해 주세요.');
    }
    return decoded;
  } catch (e) {
    if (e instanceof AuthSignupOAuthError) throw e;
    throw new AuthSignupOAuthError(
      'Google 인증이 만료되었습니다. 다시 「Google로 시작」을 눌러 주세요.',
    );
  }
}
