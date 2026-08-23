import type { AuthIdentityProvider } from '@prisma/client';
import {
  assertTenantStaffLoginAllowed,
  TenantBillingAccessBlockedError,
  TenantSuspendedError,
} from '../tenants/tenant.service.js';
import { AuthSignupOAuthError } from './signupOAuth.errors.js';
import { resolveAdminOAuthLogin } from './signupOAuthIdentity.service.js';
import { verifyGoogleIdTokenCredentials } from './signupOAuthGoogle.service.js';
import { resolveKakaoOAuthCredentialsFromCode } from './signupOAuthKakao.service.js';

async function loginAdminWithOAuthProviderSub(
  provider: AuthIdentityProvider,
  providerSub: string,
  tenantSlugOptional?: string,
) {
  const { user, tenant } = await resolveAdminOAuthLogin(provider, providerSub, tenantSlugOptional);

  try {
    await assertTenantStaffLoginAllowed(tenant);
  } catch (e) {
    if (e instanceof TenantSuspendedError || e instanceof TenantBillingAccessBlockedError) {
      throw new AuthSignupOAuthError(e.message, 403);
    }
    throw e;
  }

  return { user, tenant };
}

export async function loginAdminWithGoogleOAuth(idTokenRaw: string, tenantSlugOptional?: string) {
  const { sub } = await verifyGoogleIdTokenCredentials(idTokenRaw);
  return loginAdminWithOAuthProviderSub('google', sub, tenantSlugOptional);
}

export async function loginAdminWithKakaoOAuth(
  codeRaw: string,
  redirectUriRaw: string,
  tenantSlugOptional?: string,
) {
  const { sub } = await resolveKakaoOAuthCredentialsFromCode(codeRaw, redirectUriRaw);
  return loginAdminWithOAuthProviderSub('kakao', sub, tenantSlugOptional);
}
