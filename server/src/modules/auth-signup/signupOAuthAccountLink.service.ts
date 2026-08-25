import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { AuthSignupOAuthError } from './signupOAuth.errors.js';
import {
  resolveKakaoOAuthCredentialsFromCode,
  unlinkKakaoUserAtProvider,
} from './signupOAuthKakao.service.js';

async function assertAdminPasswordVerified(userId: string, tenantId: string, passwordRaw: string) {
  const password = passwordRaw.trim();
  if (!password) {
    throw new AuthSignupOAuthError('비밀번호를 입력해 주세요.', 400);
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, tenantId },
    select: { role: true, passwordHash: true, isActive: true },
  });

  if (!user?.isActive) {
    throw new AuthSignupOAuthError('계정을 찾을 수 없습니다.', 404);
  }
  if (user.role !== 'ADMIN') {
    throw new AuthSignupOAuthError('관리자(ADMIN) 계정만 카카오 연결을 이용할 수 있습니다.', 403);
  }
  if (!user.passwordHash) {
    throw new AuthSignupOAuthError(
      '비밀번호가 설정되지 않은 계정입니다. 비밀번호를 먼저 설정한 뒤 카카오를 연결해 주세요.',
      400,
    );
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new AuthSignupOAuthError('비밀번호가 일치하지 않습니다.', 401);
  }
}

export async function listOAuthIdentitiesForUser(userId: string, tenantId: string) {
  return prisma.userAuthIdentity.findMany({
    where: { userId, tenantId },
    select: {
      provider: true,
      providerEmail: true,
      linkedAt: true,
    },
    orderBy: { linkedAt: 'asc' },
  });
}

export async function linkKakaoToAdminUser(input: {
  userId: string;
  tenantId: string;
  password: string;
  code: string;
  redirectUri: string;
}) {
  await assertAdminPasswordVerified(input.userId, input.tenantId, input.password);

  const existingOwn = await prisma.userAuthIdentity.findUnique({
    where: {
      tenantId_userId_provider: {
        tenantId: input.tenantId,
        userId: input.userId,
        provider: 'kakao',
      },
    },
    select: { id: true },
  });
  if (existingOwn) {
    throw new AuthSignupOAuthError('이미 카카오 계정이 연결되어 있습니다.', 409);
  }

  const { sub, providerEmail } = await resolveKakaoOAuthCredentialsFromCode(
    input.code,
    input.redirectUri,
  );

  const existingSub = await prisma.userAuthIdentity.findUnique({
    where: {
      provider_providerSub: { provider: 'kakao', providerSub: sub },
    },
    select: { userId: true, tenantId: true },
  });
  if (existingSub) {
    if (existingSub.userId === input.userId && existingSub.tenantId === input.tenantId) {
      throw new AuthSignupOAuthError('이미 카카오 계정이 연결되어 있습니다.', 409);
    }
    throw new AuthSignupOAuthError(
      '이미 다른 청소비서 계정에 연결된 카카오 계정입니다.',
      409,
    );
  }

  await prisma.userAuthIdentity.create({
    data: {
      tenantId: input.tenantId,
      userId: input.userId,
      provider: 'kakao',
      providerSub: sub,
      providerEmail,
      linkedAt: new Date(),
    },
  });

  return {
    provider: 'kakao' as const,
    providerEmail,
    linkedAt: new Date().toISOString(),
  };
}

export async function unlinkKakaoFromAdminUser(input: {
  userId: string;
  tenantId: string;
  password: string;
}) {
  await assertAdminPasswordVerified(input.userId, input.tenantId, input.password);

  const identity = await prisma.userAuthIdentity.findUnique({
    where: {
      tenantId_userId_provider: {
        tenantId: input.tenantId,
        userId: input.userId,
        provider: 'kakao',
      },
    },
    select: { id: true, providerSub: true },
  });

  if (!identity) {
    throw new AuthSignupOAuthError('연결된 카카오 계정이 없습니다.', 404);
  }

  await prisma.userAuthIdentity.delete({ where: { id: identity.id } });
  await unlinkKakaoUserAtProvider(identity.providerSub);

  return { ok: true as const };
}
