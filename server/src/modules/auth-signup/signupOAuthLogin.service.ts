import type { AuthIdentityProvider } from '@prisma/client';
import {
  assertTenantStaffLoginAllowed,
  TenantBillingAccessBlockedError,
  TenantSuspendedError,
} from '../tenants/tenant.service.js';
import { isUserEmployedOnYmd, kstTodayYmd } from '../users/userEmployment.js';
import {
  assertTeamLeaderLoginAllowed,
  mapTenantPlanLimitError,
} from '../tenants/tenantPlanLimits.service.js';
import { AuthSignupOAuthError } from './signupOAuth.errors.js';
import { resolveStaffOAuthLogin } from './signupOAuthIdentity.service.js';
import { verifyGoogleIdTokenCredentials } from './signupOAuthGoogle.service.js';
import { resolveKakaoOAuthCredentialsFromCode } from './signupOAuthKakao.service.js';

async function loginStaffWithOAuthProviderSub(
  provider: AuthIdentityProvider,
  providerSub: string,
  tenantSlugOptional?: string,
) {
  const { user, tenant } = await resolveStaffOAuthLogin(provider, providerSub, tenantSlugOptional);

  if (
    (user.role === 'TEAM_LEADER' ||
      user.role === 'MARKETER' ||
      user.role === 'EXTERNAL_PARTNER') &&
    !isUserEmployedOnYmd(user.hireDate, user.resignationDate, kstTodayYmd())
  ) {
    throw new AuthSignupOAuthError('입사·퇴사 기간에 해당하지 않는 계정입니다.', 401);
  }

  if (user.role === 'TEAM_LEADER') {
    try {
      await assertTeamLeaderLoginAllowed(tenant.plan);
    } catch (e) {
      const mapped = mapTenantPlanLimitError(e);
      if (mapped) {
        throw new AuthSignupOAuthError(mapped.message, 403);
      }
      throw e;
    }
  }

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
  return loginStaffWithOAuthProviderSub('google', sub, tenantSlugOptional);
}

export async function loginAdminWithKakaoOAuth(
  codeRaw: string,
  redirectUriRaw: string,
  tenantSlugOptional?: string,
) {
  const { sub } = await resolveKakaoOAuthCredentialsFromCode(codeRaw, redirectUriRaw);
  return loginStaffWithOAuthProviderSub('kakao', sub, tenantSlugOptional);
}
