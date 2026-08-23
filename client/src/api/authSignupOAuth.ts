import type { AuthIdentityProvider } from '@shared/authSignup';

const API = '/api/public/auth-signup';

export type GoogleSignupOAuthConfig = {
  enabled: boolean;
  clientId: string;
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
