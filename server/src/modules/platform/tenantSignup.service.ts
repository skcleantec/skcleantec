import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { seedTenantDefaults } from '../tenants/tenantConfigSeed.service.js';
import { modulesForPlan } from '../tenants/tenantFeatureCatalog.js';
import { ensureDefaultAdChannelsForTenant } from '../advertising/defaultAdChannels.js';
import { assertValidTenantLoginId } from '../auth/tenantLoginId.js';
import {
  assertValidTenantSlug,
  normalizeTenantSlug,
} from './tenantProvisioning.service.js';
import { isTenantSignupReservedSlug } from './tenantSignup.constants.js';

export class TenantSignupError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 409 | 429 = 400,
  ) {
    super(message);
    this.name = 'TenantSignupError';
  }
}

export type SelfServeTenantSignupInput = {
  slug: string;
  name: string;
  adminLoginId: string;
  adminPassword: string;
  adminName?: string;
  contactEmail: string;
  contactPhone?: string | null;
  memberTermsAgreed: boolean;
  signupIp?: string | null;
};

export async function isTenantSlugAvailableForSignup(slugRaw: string): Promise<{
  available: boolean;
  slug: string;
  reason?: string;
}> {
  const slug = normalizeTenantSlug(slugRaw);
  try {
    assertValidTenantSlug(slug);
  } catch {
    return { available: false, slug, reason: '업체 코드 형식이 올바르지 않습니다.' };
  }
  if (isTenantSignupReservedSlug(slug)) {
    return { available: false, slug, reason: '사용할 수 없는 업체 코드입니다.' };
  }
  const taken = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (taken) {
    return { available: false, slug, reason: '이미 사용 중인 업체 코드입니다.' };
  }
  return { available: true, slug };
}

function assertSignupContact(email: string, phone?: string | null) {
  const e = email.trim();
  if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
    throw new TenantSignupError('담당자 이메일을 확인해 주세요.');
  }
  const p = phone?.trim() ?? '';
  if (p && !/^[\d+\-() ]{8,20}$/.test(p)) {
    throw new TenantSignupError('담당자 연락처 형식을 확인해 주세요.');
  }
}

/** 셀프 가입 — Free 플랜·ACTIVE 만 허용 */
export async function provisionTenantSelfServe(input: SelfServeTenantSignupInput) {
  if (!input.memberTermsAgreed) {
    throw new TenantSignupError('회원사 이용약관에 동의해 주세요.');
  }

  const slugCheck = await isTenantSlugAvailableForSignup(input.slug);
  if (!slugCheck.available) {
    throw new TenantSignupError(slugCheck.reason ?? '업체 코드를 사용할 수 없습니다.', 409);
  }
  const slug = slugCheck.slug;

  const name = input.name.trim();
  if (!name) throw new TenantSignupError('업체명을 입력해 주세요.');

  const adminLoginId = assertValidTenantLoginId(input.adminLoginId);
  const adminName = (input.adminName?.trim() || '관리자').slice(0, 64);
  assertSignupContact(input.contactEmail, input.contactPhone);

  const password = input.adminPassword.trim();
  if (password.length < 4) {
    throw new TenantSignupError('비밀번호는 4자 이상 입력해 주세요.');
  }

  const contactEmail = input.contactEmail.trim().toLowerCase();
  const recentSameEmail = await prisma.tenant.count({
    where: {
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      config: { path: ['signup', 'contactEmail'], equals: contactEmail },
    },
  });
  if (recentSameEmail >= 3) {
    throw new TenantSignupError('같은 이메일로 너무 많은 가입 시도가 있었습니다. 잠시 후 다시 시도해 주세요.', 429);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const planModules = modulesForPlan('free');
  const agreedAt = new Date().toISOString();

  const result = await prisma.$transaction(
    async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          slug,
          name,
          plan: 'free',
          status: 'ACTIVE',
          config: {
            signup: {
              source: 'self_serve',
              contactEmail,
              contactPhone: input.contactPhone?.trim() || null,
              memberTermsAgreedAt: agreedAt,
              memberTermsAgreedIp: input.signupIp?.trim() || null,
            },
            subscription: {
              planUpdatedAt: agreedAt,
            },
          },
        },
      });

      await tx.tenantBillingProfile.create({
        data: { tenantId: tenant.id, billingCycle: 'MONTHLY' },
      });

      for (const moduleId of planModules) {
        await tx.tenantFeature.create({
          data: { tenantId: tenant.id, moduleId, enabled: true },
        });
      }

      const admin = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: adminLoginId,
          passwordHash,
          name: adminName,
          role: 'ADMIN',
          isTenantOwner: true,
          phone: input.contactPhone?.trim() || null,
        },
        select: { id: true, email: true, name: true },
      });

      await seedTenantDefaults(tx, tenant.id, tenant.name);
      await ensureDefaultAdChannelsForTenant(tx, tenant.id);

      return { tenant, admin };
    },
    { maxWait: 15_000, timeout: 30_000 },
  );

  return result;
}
