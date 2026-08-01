import type { Prisma, TenantReferralSignupMethod } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { assertValidReferrerCode, normalizeReferrerCode } from './platformReferralCode.helpers.js';

export class PlatformReferralAttributionError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 404 = 400,
  ) {
    super(message);
    this.name = 'PlatformReferralAttributionError';
  }
}

export async function resolveActiveReferrerByCode(codeRaw: string) {
  const code = normalizeReferrerCode(codeRaw);
  if (!code) return null;
  try {
    assertValidReferrerCode(code);
  } catch {
    return null;
  }
  return prisma.platformReferrer.findFirst({
    where: { code, status: 'ACTIVE' },
    select: {
      id: true,
      code: true,
      displayName: true,
      type: true,
      commissionRateBps: true,
      eligiblePlanIds: true,
    },
  });
}

export async function validateReferrerCodeForPublic(codeRaw: string) {
  const code = normalizeReferrerCode(codeRaw);
  if (!code) {
    return { valid: false as const, reason: '추천인 코드를 입력해 주세요.' };
  }
  try {
    assertValidReferrerCode(code);
  } catch (e) {
    return { valid: false as const, reason: e instanceof Error ? e.message : '올바르지 않은 코드입니다.' };
  }
  const referrer = await prisma.platformReferrer.findUnique({
    where: { code },
    select: { id: true, displayName: true, status: true },
  });
  if (!referrer) {
    return { valid: false as const, reason: '존재하지 않는 추천인 코드입니다.' };
  }
  if (referrer.status !== 'ACTIVE') {
    return { valid: false as const, reason: '현재 사용할 수 없는 추천인 코드입니다.' };
  }
  return {
    valid: true as const,
    code,
    displayName: referrer.displayName,
  };
}

export async function createTenantReferralAttribution(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    referrerCodeRaw: string;
    signupMethod: TenantReferralSignupMethod;
  },
) {
  const refCodeUsed = normalizeReferrerCode(input.referrerCodeRaw);
  if (!refCodeUsed) {
    throw new PlatformReferralAttributionError('추천인 코드를 확인해 주세요.');
  }
  assertValidReferrerCode(refCodeUsed);

  const referrer = await tx.platformReferrer.findFirst({
    where: { code: refCodeUsed, status: 'ACTIVE' },
    select: { id: true },
  });
  if (!referrer) {
    throw new PlatformReferralAttributionError('유효하지 않은 추천인 코드입니다.');
  }

  const existing = await tx.tenantReferralAttribution.findUnique({
    where: { tenantId: input.tenantId },
    select: { id: true },
  });
  if (existing) {
    throw new PlatformReferralAttributionError('이미 추천인이 연결된 업체입니다.');
  }

  return tx.tenantReferralAttribution.create({
    data: {
      tenantId: input.tenantId,
      referrerId: referrer.id,
      signupMethod: input.signupMethod,
      refCodeUsed,
    },
  });
}
