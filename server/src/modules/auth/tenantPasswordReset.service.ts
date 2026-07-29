import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { normalizeTenantSlugInput } from '../tenants/tenant.service.js';
import {
  consumeEmailVerificationChallenge,
  EmailVerificationError,
  normalizeVerificationEmail,
  sendEmailVerificationCode,
} from '../platform/emailVerification.service.js';

export class TenantPasswordResetError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 404 | 429 | 503 = 400,
  ) {
    super(message);
    this.name = 'TenantPasswordResetError';
  }
}

async function findOwnerBySlugAndRecoveryEmail(tenantSlug: string, recoveryEmail: string) {
  const slug = normalizeTenantSlugInput(tenantSlug);
  if (!slug || slug === 'sk') {
    throw new TenantPasswordResetError('업체 코드 또는 이메일 정보를 확인해 주세요.', 404);
  }
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true, slug: true } });
  if (!tenant) {
    throw new TenantPasswordResetError('업체 코드 또는 이메일 정보를 확인해 주세요.', 404);
  }
  const email = normalizeVerificationEmail(recoveryEmail);
  const user = await prisma.user.findFirst({
    where: {
      tenantId: tenant.id,
      isTenantOwner: true,
      isActive: true,
      role: 'ADMIN',
      recoveryEmail: email,
    },
    select: { id: true, tenantId: true, name: true, email: true },
  });
  if (!user) {
    throw new TenantPasswordResetError('업체 코드 또는 이메일 정보를 확인해 주세요.', 404);
  }
  return { tenant, user, recoveryEmail: email };
}

export async function sendTenantPasswordResetCode(input: {
  tenantSlug: string;
  recoveryEmail: string;
  requestIp?: string | null;
}) {
  const { tenant, user, recoveryEmail } = await findOwnerBySlugAndRecoveryEmail(
    input.tenantSlug,
    input.recoveryEmail,
  );

  return sendEmailVerificationCode({
    purpose: 'PASSWORD_RESET',
    email: recoveryEmail,
    requestIp: input.requestIp,
    payload: {
      tenantId: tenant.id,
      tenantSlug: tenant.slug,
      userId: user.id,
      loginId: user.email,
    },
    mailSubject: '[청소비서] 비밀번호 재설정 인증번호',
    mailHtml: (code) =>
      `<p>청소비서 비밀번호 재설정 인증번호입니다.</p><p>업체 코드: <strong>${tenant.slug}</strong></p><p style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</p><p>10분 이내에 입력해 주세요. 본인이 요청하지 않았다면 무시하세요.</p>`,
    mailText: (code) =>
      `청소비서 비밀번호 재설정 (${tenant.slug}) 인증번호: ${code} (10분 유효)`,
  });
}

type PasswordResetPayload = {
  tenantId: string;
  tenantSlug: string;
  userId: string;
  loginId: string;
};

export async function confirmTenantPasswordReset(input: {
  tenantSlug: string;
  recoveryEmail: string;
  challengeId: string;
  code: string;
  newPassword: string;
}) {
  const email = normalizeVerificationEmail(input.recoveryEmail);
  const password = input.newPassword.trim();
  if (password.length < 4) {
    throw new TenantPasswordResetError('새 비밀번호는 4자 이상 입력해 주세요.');
  }

  const payload = (await consumeEmailVerificationChallenge({
    purpose: 'PASSWORD_RESET',
    challengeId: input.challengeId,
    email,
    code: input.code,
  })) as PasswordResetPayload;

  const slug = normalizeTenantSlugInput(input.tenantSlug);
  if (payload.tenantSlug !== slug) {
    throw new TenantPasswordResetError('업체 코드 또는 이메일 정보를 확인해 주세요.', 404);
  }

  const user = await prisma.user.findFirst({
    where: {
      id: payload.userId,
      tenantId: payload.tenantId,
      isTenantOwner: true,
      recoveryEmail: email,
    },
    select: { id: true },
  });
  if (!user) {
    throw new TenantPasswordResetError('업체 코드 또는 이메일 정보를 확인해 주세요.', 404);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  return {
    ok: true as const,
    message: '비밀번호가 변경되었습니다. 새 비밀번호로 로그인해 주세요.',
    loginId: payload.loginId,
    tenantSlug: payload.tenantSlug,
  };
}

export { EmailVerificationError as TenantPasswordResetVerificationError };
