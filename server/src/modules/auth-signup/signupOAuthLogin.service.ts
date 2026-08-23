import type { AuthIdentityProvider } from '@prisma/client';
import {
  assertTenantStaffLoginAllowed,
  normalizeTenantSlugInput,
  resolveTenantBySlug,
  TenantBillingAccessBlockedError,
  TenantNotFoundError,
  TenantSuspendedError,
} from '../tenants/tenant.service.js';
import { AuthSignupOAuthError } from './signupOAuth.errors.js';
import { findAdminUserForOAuthLogin } from './signupOAuthIdentity.service.js';
import { verifyGoogleIdTokenCredentials } from './signupOAuthGoogle.service.js';
import { resolveKakaoOAuthCredentialsFromCode } from './signupOAuthKakao.service.js';

type OAuthLoginUser = Awaited<ReturnType<typeof findAdminUserForOAuthLogin>>;
type OAuthLoginTenant = Awaited<ReturnType<typeof resolveTenantBySlug>>;

async function resolveTenantForOAuthLogin(tenantSlugRaw: string): Promise<OAuthLoginTenant> {
  const tenantSlug = tenantSlugRaw.trim();
  if (!tenantSlug) {
    throw new AuthSignupOAuthError('업체 코드를 입력해 주세요.');
  }

  try {
    const tenant = await resolveTenantBySlug(normalizeTenantSlugInput(tenantSlug));
    await assertTenantStaffLoginAllowed(tenant);
    return tenant;
  } catch (e) {
    if (e instanceof TenantNotFoundError) {
      throw new AuthSignupOAuthError(e.message, 404);
    }
    if (e instanceof TenantSuspendedError || e instanceof TenantBillingAccessBlockedError) {
      throw new AuthSignupOAuthError(e.message, 403);
    }
    throw e;
  }
}

async function loginAdminWithOAuthProviderSub(
  tenantSlugRaw: string,
  provider: AuthIdentityProvider,
  providerSub: string,
): Promise<{ user: OAuthLoginUser; tenant: OAuthLoginTenant }> {
  const tenant = await resolveTenantForOAuthLogin(tenantSlugRaw);
  const user = await findAdminUserForOAuthLogin(tenant.id, provider, providerSub);
  return { user, tenant };
}

export async function loginAdminWithGoogleOAuth(tenantSlugRaw: string, idTokenRaw: string) {
  const { sub } = await verifyGoogleIdTokenCredentials(idTokenRaw);
  return loginAdminWithOAuthProviderSub(tenantSlugRaw, 'google', sub);
}

export async function loginAdminWithKakaoOAuth(
  tenantSlugRaw: string,
  codeRaw: string,
  redirectUriRaw: string,
) {
  const { sub } = await resolveKakaoOAuthCredentialsFromCode(codeRaw, redirectUriRaw);
  return loginAdminWithOAuthProviderSub(tenantSlugRaw, 'kakao', sub);
}
