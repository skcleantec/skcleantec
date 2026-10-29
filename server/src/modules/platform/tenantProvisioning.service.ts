import bcrypt from 'bcryptjs';
import type { Prisma, TenantStatus, TenantSuspendReason } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { notifyTenantCapabilitiesRefresh } from '../realtime/inboxNotify.js';
import { seedTenantDefaults } from '../tenants/tenantConfigSeed.service.js';
import {
  CORE_FEATURE_MODULE_IDS,
  isKnownFeatureModuleId,
  modulesForPlan,
  TENANT_FEATURE_MODULES,
  type TenantFeatureModuleId,
  TENANT_PLAN_ID_SET,
} from '../tenants/tenantFeatureCatalog.js';
import { kstMonthRangeYm, kstTodayYmd } from '../inquiries/inquiryListDateRange.js';
import {
  readTelecrmMetaForPreserve,
  restoreTelecrmMetaIfMissing,
  getTelecrmFeatureRow,
} from '../telecrm/telecrmTenantPolicy.service.js';
import { ensureDefaultAdChannelsForTenant } from '../advertising/defaultAdChannels.js';
import { customModulesForTenantSlug, isCustomModuleId, isRegisteredCustomModuleId } from '../custom/customModuleCatalog.js';
import { getTenantConfig, updateTenantConfig } from '../tenants/tenantConfig.service.js';
import { serializeTenantSignupBusinessForPlatform } from '../auth-signup/signupBusiness.service.js';
import { assertValidTenantLoginId } from '../auth/tenantLoginId.js';
import {
  adminLoginIdsSummaryForTenants,
  listTenantAdminsForPlatform,
} from './tenantAdmins.service.js';
import { trialEndsAtFromCreated } from '../billing/tenantBilling.service.js';
import { TenantNotFoundError } from '../tenants/tenant.service.js';
import {
  buildSignupConfigPatch,
  resolveSignupTrialApplication,
} from './signupTrialEvent.service.js';
import {
  loadOwnerAuthProvidersByTenant,
  resolveTenantSignupAuthMethodForPlatform,
} from './tenantSignupAuthMethod.helpers.js';

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/;

export function normalizeTenantSlug(raw: string): string {
  return raw.trim().toLowerCase();
}

export function assertValidTenantSlug(slug: string): void {
  if (!slug || !SLUG_RE.test(slug)) {
    throw new Error('업체 코드는 영문 소문자·숫자·하이픈(2~48자)만 사용할 수 있습니다.');
  }
}

export type ProvisionTenantInput = {
  slug: string;
  name: string;
  plan: string;
  adminLoginId: string;
  adminPassword: string;
  adminName?: string;
  status?: TenantStatus;
};

export async function provisionTenant(input: ProvisionTenantInput) {
  const slug = normalizeTenantSlug(input.slug);
  const name = input.name.trim();
  const adminLoginId = assertValidTenantLoginId(input.adminLoginId);
  const adminName = (input.adminName?.trim() || '관리자').slice(0, 64);
  const plan = input.plan in TENANT_PLAN_ID_SET ? input.plan : 'free';
  const now = new Date();
  const trialApp = await resolveSignupTrialApplication({
    plan,
    source: 'platform_provision',
    now,
  });
  // Free=체험 없음 / 유료=이벤트 ON이면 자동 체험, OFF면 체험 전
  const status = trialApp.status;

  assertValidTenantSlug(slug);
  if (!name) throw new Error('업체명을 입력해주세요.');
  if (!input.adminPassword.trim()) {
    throw new Error('관리자 아이디와 비밀번호를 입력해주세요.');
  }

  const slugTaken = await prisma.tenant.findUnique({ where: { slug } });
  if (slugTaken) throw new Error('이미 사용 중인 업체 코드입니다.');

  const passwordHash = await bcrypt.hash(input.adminPassword.trim(), 10);
  const planModules = modulesForPlan(plan);

  const result = await prisma.$transaction(
    async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          slug,
          name,
          plan,
          status,
          trialEndsAt: trialApp.trialEndsAt,
          prepaidConfirmedAt: trialApp.prepaidConfirmedAt,
          config: {
            signup: buildSignupConfigPatch({}, trialApp, {
              source: 'platform_provision',
              selectedPlan: plan,
            }),
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

export async function listTenantsForPlatform() {
  const [rows, ownerAuthProvidersByTenant] = await Promise.all([
    prisma.tenant.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        slug: true,
        name: true,
        plan: true,
        status: true,
        createdAt: true,
        config: true,
        _count: { select: { users: true, inquiries: true } },
      },
    }),
    loadOwnerAuthProvidersByTenant(),
  ]);
  const adminMap = await adminLoginIdsSummaryForTenants(rows.map((r) => r.id));
  return rows.map((r) => {
    const adminLoginIds = adminMap.get(r.id) ?? [];
    const signupAuth = resolveTenantSignupAuthMethodForPlatform(
      r.config,
      ownerAuthProvidersByTenant,
      r.id,
    );
    return {
      id: r.id,
      slug: r.slug,
      name: r.name,
      plan: r.plan,
      status: r.status,
      createdAt: r.createdAt,
      userCount: r._count.users,
      inquiryCount: r._count.inquiries,
      adminLoginIds,
      ownerLoginId: adminLoginIds[0] ?? null,
      signupAuthMethod: signupAuth.method,
      signupAuthLabel: signupAuth.label,
      signupAuthCategory: signupAuth.category,
    };
  });
}

/** 플랜과 같은 행은 개별 설정이 아니다. 없는 행·같은 값은 기본 따름. */
function displayFeatureOverride(
  stored: boolean | undefined,
  inPlan: boolean,
  forced: boolean,
): boolean | null {
  if (forced || stored === undefined) return null;
  if (stored && !inPlan) return true;
  if (!stored && inPlan) return false;
  return null;
}

export async function getTenantDetailForPlatform(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      slug: true,
      name: true,
      plan: true,
      status: true,
      timezone: true,
      config: true,
      createdAt: true,
      suspendedAt: true,
    },
  });
  if (!tenant) throw new TenantNotFoundError();

  const overrides = await prisma.tenantFeature.findMany({
    where: { tenantId },
    select: { moduleId: true, enabled: true },
  });
  const overrideMap = new Map(overrides.map((o) => [o.moduleId, o.enabled]));
  const planModules = new Set(modulesForPlan(tenant.plan));
  const customDefs = customModulesForTenantSlug(tenant.slug);

  const baseCatalog = Object.entries(TENANT_FEATURE_MODULES).map(([moduleId, meta]) => {
    const id = moduleId as TenantFeatureModuleId;
    const inPlan = planModules.has(id);
    const stored = overrideMap.has(moduleId) ? overrideMap.get(moduleId)! : undefined;
    const locked = CORE_FEATURE_MODULE_IDS.has(id);
    const override = displayFeatureOverride(stored, inPlan, locked);
    let effective = inPlan;
    if (override === true) effective = true;
    if (override === false) effective = false;
    if (locked) effective = true;
    return {
      moduleId: id,
      label: meta.label,
      tier: meta.tier,
      locked,
      inPlan,
      override,
      enabled: effective,
      effective,
    };
  });

  const customCatalog = customDefs.map((def) => {
    const stored = overrideMap.has(def.moduleId) ? overrideMap.get(def.moduleId)! : undefined;
    const override = displayFeatureOverride(stored, false, false);
    const effective = override === true;
    return {
      moduleId: def.moduleId,
      label: def.label,
      tier: 'custom' as const,
      locked: false,
      inPlan: false,
      override,
      enabled: effective,
      effective,
    };
  });

  const config = await getTenantConfig(tenantId);
  const admins = await listTenantAdminsForPlatform(tenantId);

  const [signupBusinessRow, ownerContact, ownerAuthProvidersByTenant] = await Promise.all([
    prisma.tenantSignupBusiness.findUnique({
      where: { tenantId },
      select: {
        businessType: true,
        bizNumber: true,
        businessName: true,
        representativeName: true,
        addressLine: true,
        businessRegistrationImageUrl: true,
        individualConfirmedAt: true,
        individualUsageNote: true,
        submittedAt: true,
      },
    }),
    prisma.user.findFirst({
      where: { tenantId, role: 'ADMIN', isTenantOwner: true },
      select: { recoveryEmail: true, phone: true },
    }),
    loadOwnerAuthProvidersByTenant(),
  ]);

  const signupBusiness = signupBusinessRow
    ? serializeTenantSignupBusinessForPlatform(signupBusinessRow, ownerContact)
    : null;

  const signupAuth = resolveTenantSignupAuthMethodForPlatform(
    tenant.config,
    ownerAuthProvidersByTenant,
    tenantId,
  );

  const monthRange = kstMonthRangeYm(kstTodayYmd().slice(0, 7));
  const [userCount, inquiryCount, monthInquiryCount] = await Promise.all([
    prisma.user.count({ where: { tenantId } }),
    prisma.inquiry.count({ where: { tenantId } }),
    monthRange
      ? prisma.inquiry.count({
          where: { tenantId, createdAt: { gte: monthRange.gte, lte: monthRange.lte } },
        })
      : Promise.resolve(0),
  ]);

  return {
    tenant: { ...tenant, userCount, inquiryCount },
    stats: { monthInquiryCount },
    admins,
    owner: admins[0] ?? null,
    features: [...baseCatalog, ...customCatalog],
    planModules: [...planModules],
    config,
    signupBusiness,
    signupAuthMethod: signupAuth.method,
    signupAuthLabel: signupAuth.label,
    signupAuthCategory: signupAuth.category,
  };
}

export async function updateTenantBasics(
  tenantId: string,
  data: { slug?: string; name?: string; plan?: string; status?: TenantStatus },
) {
  const existing = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!existing) throw new TenantNotFoundError();

  const patch: {
    slug?: string;
    name?: string;
    plan?: string;
    status?: TenantStatus;
    suspendedAt?: Date | null;
    suspendReason?: TenantSuspendReason | null;
    billingAccessBlockedAt?: Date | null;
    trialEndsAt?: Date;
  } = {};
  if (data.slug !== undefined) {
    const slug = normalizeTenantSlug(data.slug);
    assertValidTenantSlug(slug);
    if (slug !== existing.slug) {
      const slugTaken = await prisma.tenant.findFirst({
        where: { slug, id: { not: tenantId } },
      });
      if (slugTaken) throw new Error('이미 사용 중인 업체 코드입니다.');
      patch.slug = slug;
    }
  }
  if (data.name !== undefined) {
    const name = data.name.trim();
    if (!name) throw new Error('업체명을 입력해주세요.');
    patch.name = name;
  }
  if (data.plan !== undefined) {
    if (!(data.plan in TENANT_PLAN_ID_SET)) {
      throw new Error('유효하지 않은 플랜입니다.');
    }
    patch.plan = data.plan;
  }
  if (data.status !== undefined) {
    patch.status = data.status;
    if (data.status === 'SUSPENDED') {
      patch.suspendedAt = new Date();
      patch.suspendReason = 'PLATFORM';
      patch.billingAccessBlockedAt = new Date();
    } else if (data.status === 'ACTIVE') {
      patch.suspendedAt = null;
      patch.suspendReason = null;
      patch.billingAccessBlockedAt = null;
    } else if (data.status === 'TRIAL') {
      patch.suspendedAt = null;
      patch.suspendReason = null;
      patch.billingAccessBlockedAt = null;
      if (!existing.trialEndsAt) {
        patch.trialEndsAt = trialEndsAtFromCreated(existing.createdAt);
      }
    }
  }

  const updated = await prisma.tenant.update({
    where: { id: tenantId },
    data: patch,
    select: { id: true, slug: true, name: true, plan: true, status: true },
  });
  if (patch.plan && patch.plan !== existing.plan) {
    void notifyTenantCapabilitiesRefresh(tenantId).catch((e) => console.error('[tenant-capabilities]', e));
  }
  return updated;
}

export async function replaceTenantFeatureOverrides(
  tenantId: string,
  items: { moduleId: string; enabled: boolean }[],
) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new TenantNotFoundError();

  const preservedTelecrmMeta = await readTelecrmMetaForPreserve(tenantId);

  await prisma.$transaction(async (tx) => {
    await tx.tenantFeature.deleteMany({ where: { tenantId } });

    for (const item of items) {
      if (isCustomModuleId(item.moduleId)) {
        if (!isRegisteredCustomModuleId(item.moduleId)) continue;
        await tx.tenantFeature.create({
          data: { tenantId, moduleId: item.moduleId, enabled: item.enabled },
        });
        continue;
      }
      if (!isKnownFeatureModuleId(item.moduleId)) continue;
      if (CORE_FEATURE_MODULE_IDS.has(item.moduleId)) continue;
      await tx.tenantFeature.create({
        data: { tenantId, moduleId: item.moduleId, enabled: item.enabled },
      });
    }
  });

  const telecrmSent = items.find((item) => item.moduleId === 'mod_telecrm');
  if (
    preservedTelecrmMeta &&
    modulesForPlan(tenant.plan).includes('mod_telecrm') &&
    telecrmSent?.enabled !== false
  ) {
    const existing = await prisma.tenantFeature.findUnique({
      where: { tenantId_moduleId: { tenantId, moduleId: 'mod_telecrm' } },
      select: { moduleId: true },
    });
    if (!existing) {
      await prisma.tenantFeature.create({
        data: {
          tenantId,
          moduleId: 'mod_telecrm',
          enabled: true,
          meta: preservedTelecrmMeta,
        },
      });
    }
  }

  await restoreTelecrmMetaIfMissing(tenantId, preservedTelecrmMeta);
  void notifyTenantCapabilitiesRefresh(tenantId).catch((e) => console.error('[tenant-capabilities]', e));
}

export async function resetTenantFeaturesFromPlan(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new TenantNotFoundError();

  const telecrmRow = await getTelecrmFeatureRow(tenantId);
  const telecrmWasLicensed = telecrmRow?.enabled === true;
  const preservedTelecrmMeta = await readTelecrmMetaForPreserve(tenantId);

  const planModules = modulesForPlan(tenant.plan);
  await prisma.$transaction([
    prisma.tenantFeature.deleteMany({ where: { tenantId } }),
    prisma.tenantFeature.createMany({
      data: planModules.map((moduleId) => ({ tenantId, moduleId, enabled: true })),
      skipDuplicates: true,
    }),
  ]);

  if (telecrmWasLicensed && !planModules.includes('mod_telecrm')) {
    await prisma.tenantFeature.create({
      data: {
        tenantId,
        moduleId: 'mod_telecrm',
        enabled: true,
        meta: preservedTelecrmMeta ?? undefined,
      },
    });
  } else {
    await restoreTelecrmMetaIfMissing(tenantId, preservedTelecrmMeta);
  }
  void notifyTenantCapabilitiesRefresh(tenantId).catch((e) => console.error('[tenant-capabilities]', e));
}

export async function updateTenantConfigForPlatform(tenantId: string, body: unknown) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new TenantNotFoundError();
  return updateTenantConfig(tenantId, body);
}
