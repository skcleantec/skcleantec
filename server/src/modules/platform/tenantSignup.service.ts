import { prisma } from '../../lib/prisma.js';
import { seedTenantDefaults } from '../tenants/tenantConfigSeed.service.js';
import { modulesForPlan, type TenantPlanId } from '../tenants/tenantFeatureCatalog.js';
import { ensureDefaultAdChannelsForTenant } from '../advertising/defaultAdChannels.js';
import { assertValidTenantLoginId } from '../auth/tenantLoginId.js';
import {
  assertValidTenantSlug,
  normalizeTenantSlug,
} from './tenantProvisioning.service.js';
import { isTenantSignupReservedSlug, normalizeSignupPlanId } from './tenantSignup.constants.js';
import type { Prisma } from '@prisma/client';
import {
  buildSignupConfigPatch,
  resolveSignupTrialApplication,
} from './signupTrialEvent.service.js';
import {
  normalizeSignupPhone,
  normalizeVerificationEmail,
} from './emailVerification.service.js';
import {
  createTenantReferralAttribution,
  PlatformReferralAttributionError,
} from '../platform-referrals/platformReferralAttribution.service.js';
import { normalizeReferrerCode } from '../platform-referrals/platformReferralCode.helpers.js';
import {
  assertValidSignupBusinessInput,
  createTenantSignupBusiness,
  parseSignupBusinessPayload,
} from '../auth-signup/signupBusiness.service.js';
import type { SignupBusinessInput } from '../auth-signup/signupBusiness.validation.js';

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
  contactPhone: string;
  memberTermsAgreed: boolean;
  selectedPlan?: string;
  signupIp?: string | null;
  /** 이메일 인증 완료 후 bcrypt 해시 직접 전달 */
  passwordHash?: string;
  emailVerifiedAt?: string;
  referrerCode?: string | null;
  referrerFromLink?: boolean;
  /** Phase 2 — 사업자 구분 (complete 시 필수) */
  signupBusiness?: SignupBusinessInput;
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

function assertSignupContact(email: string, phone: string) {
  const e = normalizeVerificationEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) {
    throw new TenantSignupError('담당자 이메일을 확인해 주세요.');
  }
  normalizeSignupPhone(phone);
}

/** 셀프 가입 — Free=체험 없음 / 유료=활성 체험 이벤트 있을 때만 자동 체험 */
export async function provisionTenantSelfServe(input: SelfServeTenantSignupInput) {
  if (!input.memberTermsAgreed) {
    throw new TenantSignupError('회원사 이용약관에 동의해 주세요.');
  }
  if (!input.emailVerifiedAt || !input.passwordHash) {
    throw new TenantSignupError('이메일 인증을 완료한 뒤 가입해 주세요.');
  }

  let selectedPlan: TenantPlanId;
  try {
    selectedPlan = normalizeSignupPlanId(input.selectedPlan);
  } catch {
    throw new TenantSignupError('올바른 이용 플랜을 선택해 주세요.');
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
  const signupBusiness = input.signupBusiness;
  if (!signupBusiness) {
    throw new TenantSignupError('사업자 여부를 선택해 주세요.');
  }
  assertValidSignupBusinessInput(signupBusiness);

  const contactEmail = normalizeVerificationEmail(input.contactEmail);
  const contactPhone = normalizeSignupPhone(input.contactPhone);
  const passwordHash = input.passwordHash;

  const recentSameEmail = await prisma.tenant.count({
    where: {
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      config: { path: ['signup', 'contactEmail'], equals: contactEmail },
    },
  });
  if (recentSameEmail >= 3) {
    throw new TenantSignupError('같은 이메일로 너무 많은 가입 시도가 있었습니다. 잠시 후 다시 시도해 주세요.', 429);
  }

  const planModules = modulesForPlan(selectedPlan);
  const agreedAt = input.emailVerifiedAt;
  const signupStartedAt = new Date();
  const trialApp = await resolveSignupTrialApplication({
    plan: selectedPlan,
    source: 'self_serve',
    now: signupStartedAt,
  });

  let result;
  try {
    result = await prisma.$transaction(
      async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          slug,
          name,
          plan: selectedPlan,
          status: trialApp.status,
          trialEndsAt: trialApp.trialEndsAt,
          prepaidConfirmedAt: trialApp.prepaidConfirmedAt,
          config: {
            signup: buildSignupConfigPatch(
              {},
              trialApp,
              {
                source: 'self_serve',
                selectedPlan,
                contactEmail,
                contactPhone,
                emailVerifiedAt: agreedAt,
                memberTermsAgreedAt: agreedAt,
                memberTermsAgreedIp: input.signupIp?.trim() || null,
              },
            ),
            subscription: {
              planUpdatedAt: agreedAt,
            },
          } as Prisma.InputJsonValue,
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
          phone: contactPhone,
          recoveryEmail: contactEmail,
        },
        select: { id: true, email: true, name: true },
      });

      await seedTenantDefaults(tx, tenant.id, tenant.name);
      await ensureDefaultAdChannelsForTenant(tx, tenant.id);

      const referrerCode = normalizeReferrerCode(input.referrerCode ?? '');
      if (referrerCode) {
        await createTenantReferralAttribution(tx, {
          tenantId: tenant.id,
          referrerCodeRaw: referrerCode,
          signupMethod: input.referrerFromLink ? 'REF_LINK' : 'MANUAL_CODE',
        });
      }

      await createTenantSignupBusiness(tx, {
        tenantId: tenant.id,
        ...signupBusiness,
      });

      return { tenant, admin };
      },
      { maxWait: 15_000, timeout: 30_000 },
    );
  } catch (e) {
    if (e instanceof PlatformReferralAttributionError) {
      throw new TenantSignupError(e.message, e.statusCode === 404 ? 400 : e.statusCode);
    }
    if (e instanceof Error && e.name === 'SignupBusinessValidationError') {
      throw new TenantSignupError(e.message);
    }
    throw e;
  }

  return result;
}