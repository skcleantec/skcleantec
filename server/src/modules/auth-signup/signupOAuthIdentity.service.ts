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
