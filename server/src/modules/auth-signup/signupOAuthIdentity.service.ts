import type { AuthIdentityProvider, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { AuthSignupOAuthError } from './signupOAuth.errors.js';

export async function assertOAuthProviderSubAvailableForSignup(
  provider: AuthIdentityProvider,
  providerSub: string,
): Promise<void> {
  const existing = await prisma.userAuthIdentity.findUnique({
    where: {
      provider_providerSub: { provider, providerSub },
    },
    select: { id: true },
  });
  if (existing) {
    throw new AuthSignupOAuthError(
      '이미 청소비서에 가입된 Google·카카오 계정입니다. 로그인을 이용해 주세요.',
      409,
    );
  }
}

const STAFF_OAUTH_LOGIN_ROLES = ['ADMIN', 'MARKETER', 'TEAM_LEADER', 'EXTERNAL_PARTNER'] as const;

const oauthLoginUserSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  isActive: true,
  isTenantOwner: true,
  platformSupportAccessId: true,
  tenantId: true,
  hireDate: true,
  resignationDate: true,
} as const;

export async function resolveStaffOAuthLogin(
  provider: AuthIdentityProvider,
  providerSub: string,
  tenantSlugOptional?: string,
) {
  const identity = await prisma.userAuthIdentity.findUnique({
    where: {
      provider_providerSub: { provider, providerSub },
    },
    include: {
      user: { select: oauthLoginUserSelect },
      tenant: true,
    },
  });

  if (!identity) {
    throw new AuthSignupOAuthError(
      '연결된 Google·카카오 계정이 없습니다. 가입하거나 아이디·비밀번호로 로그인해 주세요.',
      401,
    );
  }

  const slugHint = tenantSlugOptional?.trim().toLowerCase();
  if (slugHint && slugHint !== identity.tenant.slug) {
    throw new AuthSignupOAuthError(
      `이 Google·카카오 계정은 업체 코드「${identity.tenant.slug}」로 연결되어 있습니다. 업체 코드를 확인해 주세요.`,
      401,
    );
  }

  const user = identity.user;
  if (!user.isActive) {
    throw new AuthSignupOAuthError('계정을 찾을 수 없거나 비활성입니다.', 401);
  }

  if (!STAFF_OAUTH_LOGIN_ROLES.includes(user.role as (typeof STAFF_OAUTH_LOGIN_ROLES)[number])) {
    throw new AuthSignupOAuthError(
      '관리자·마케터·팀장 계정만 Google·카카오 로그인을 이용할 수 있습니다.',
      401,
    );
  }

  return { user, tenant: identity.tenant };
}

/** @deprecated resolveStaffOAuthLogin 사용 */
export async function resolveAdminOAuthLogin(
  provider: AuthIdentityProvider,
  providerSub: string,
  tenantSlugOptional?: string,
) {
  return resolveStaffOAuthLogin(provider, providerSub, tenantSlugOptional);
}

/** @deprecated resolveAdminOAuthLogin 사용 */
export async function findAdminUserForOAuthLogin(
  tenantId: string,
  provider: AuthIdentityProvider,
  providerSub: string,
) {
  const result = await resolveAdminOAuthLogin(provider, providerSub);
  if (result.tenant.id !== tenantId) {
    throw new AuthSignupOAuthError(
      '이 Google·카카오 계정은 다른 업체 코드로 가입되어 있습니다. 업체 코드를 확인해 주세요.',
      401,
    );
  }
  return result.user;
}

export async function createUserAuthIdentity(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    userId: string;
    provider: AuthIdentityProvider;
    providerSub: string;
    providerEmail: string | null;
  },
) {
  await assertOAuthProviderSubAvailableForSignup(input.provider, input.providerSub);
  return tx.userAuthIdentity.create({
    data: {
      tenantId: input.tenantId,
      userId: input.userId,
      provider: input.provider,
      providerSub: input.providerSub,
      providerEmail: input.providerEmail,
      linkedAt: new Date(),
    },
  });
}
