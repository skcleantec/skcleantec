/**
 * 운영(main) — Free 1인 사업자 테스트 테넌트
 * 업체코드 ts / 아이디 admin / 비번 1111 / 이름 청소비서 1인사업자
 *
 *   cd server
 *   npx tsx scripts/seed-prod-solo-ts-tenant.ts
 *
 * SKCT_SOURCE_DATABASE_URL(운영 Proxy)에만 기록합니다. 연결 문자열은 로그에 찍지 않습니다.
 */
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { resolve } from 'node:path';
import type { Prisma } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import { seedTenantDefaults } from '../src/modules/tenants/tenantConfigSeed.service.js';
import { ensureDefaultAdChannelsForTenant } from '../src/modules/advertising/defaultAdChannels.js';
import { createTenantSignupBusiness } from '../src/modules/auth-signup/signupBusiness.service.js';
import {
  mergeOperatingCompanyConfig,
  operatingCompanyConfigToJson,
  parseOperatingCompanyConfig,
} from '../src/modules/operating-companies/operatingCompany.schema.js';
import { modulesForPlan } from '../src/modules/tenants/tenantFeatureCatalog.js';

dotenv.config({ path: resolve(process.cwd(), '.env') });

const SLUG = 'ts';
const PLAN = 'free';
const LOGIN_ID = 'admin';
const PASSWORD = '1111';
const TENANT_NAME = '청소비서 1인사업자';
const CONTACT_PHONE = '010-1111-1111';
const CONTACT_EMAIL = 'ts-solo@cbiseo.test';
const BIZ_NO = '123-81-67890';
const BIZ_NO_DIGITS = '1238167890';
const ADDRESS = '서울특별시 마포구 월드컵북로 396, 1층 (1인 사업자 테스트)';
const FAX = '02-1111-1111';
const BIZ_IMAGE_URL = 'https://www.cbiseo.com/brand/clean-secretary-logo.png';

function requireProdUrl(): string {
  const url = (
    process.env.SOLO_SEED_DATABASE_URL ??
    process.env.SKCT_TARGET_DATABASE_URL ??
    process.env.SKCT_SOURCE_DATABASE_URL ??
    ''
  ).trim();
  if (!url) {
    throw new Error('운영 DB URL(SOLO_SEED_DATABASE_URL 또는 SKCT_TARGET_DATABASE_URL)이 없습니다.');
  }
  let host = '';
  try {
    host = new URL(url.replace(/^postgresql:/, 'http:')).hostname;
  } catch {
    throw new Error('SKCT_SOURCE_DATABASE_URL 형식이 올바르지 않습니다.');
  }
  if (!host.includes('proxy.rlwy.net')) {
    throw new Error(`운영 Proxy 호스트가 아닙니다: ${host}`);
  }
  console.info(`[db] production host=${host}`);
  return url;
}

const prisma = new PrismaClient({ datasources: { db: { url: requireProdUrl() } } });

const companyRegistration = {
  companyName: TENANT_NAME,
  representativeName: TENANT_NAME,
  businessRegistrationNo: BIZ_NO,
  addressLine: ADDRESS,
  phone: CONTACT_PHONE,
  fax: FAX,
  contactEmail: CONTACT_EMAIL,
};

async function resetFreeFeatures(tenantId: string) {
  const planModules = modulesForPlan(PLAN);
  if (planModules.includes('core_assignments')) {
    throw new Error('Free 플랜에 core_assignments 가 들어 있어 시드를 중단합니다.');
  }
  await prisma.$transaction([
    prisma.tenantFeature.deleteMany({ where: { tenantId } }),
    prisma.tenantFeature.createMany({
      data: planModules.map((moduleId) => ({ tenantId, moduleId, enabled: true })),
      skipDuplicates: true,
    }),
  ]);
}

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  let tenant = await prisma.tenant.findUnique({
    where: { slug: SLUG },
    select: { id: true },
  });

  if (!tenant) {
    const created = await prisma.tenant.create({
      data: {
        slug: SLUG,
        name: TENANT_NAME,
        plan: PLAN,
        status: 'ACTIVE',
        config: {
          branding: { displayName: TENANT_NAME, loginSubtitle: '1인 사업자 테스트' },
          inquiry: { numberPrefix: 'TS' },
          companyRegistration,
          signup: { source: 'prod_solo_test_seed', selectedPlan: PLAN },
        } as Prisma.InputJsonValue,
      },
    });
    await prisma.tenantBillingProfile.create({
      data: {
        tenantId: created.id,
        billingCycle: 'MONTHLY',
        pricingMode: 'CATALOG',
        contractMemo: '운영 1인 사업자 테스트 (ts / Free)',
      },
    });
    await prisma.tenantFeature.createMany({
      data: modulesForPlan(PLAN).map((moduleId) => ({
        tenantId: created.id,
        moduleId,
        enabled: true,
      })),
    });
    await prisma.user.create({
      data: {
        tenantId: created.id,
        email: LOGIN_ID,
        passwordHash,
        name: TENANT_NAME,
        role: 'ADMIN',
        isTenantOwner: true,
        isActive: true,
        phone: CONTACT_PHONE,
        recoveryEmail: CONTACT_EMAIL,
        profileCompletedAt: new Date(),
      },
    });
    tenant = { id: created.id };
    console.info(`[create] ${SLUG}`);
  } else {
    console.info(`[exists] ${SLUG} — 사업자·계정·플랜을 다시 맞춥니다.`);
    await prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        name: TENANT_NAME,
        plan: PLAN,
        status: 'ACTIVE',
        suspendedAt: null,
        suspendReason: null,
        trialEndsAt: null,
      },
    });
    await resetFreeFeatures(tenant.id);
    await prisma.user.updateMany({
      where: { tenantId: tenant.id, email: LOGIN_ID, role: 'ADMIN' },
      data: {
        passwordHash,
        name: TENANT_NAME,
        isActive: true,
        isTenantOwner: true,
        phone: CONTACT_PHONE,
        recoveryEmail: CONTACT_EMAIL,
        profileCompletedAt: new Date(),
      },
    });
    const admin = await prisma.user.findFirst({
      where: { tenantId: tenant.id, email: LOGIN_ID, role: 'ADMIN' },
      select: { id: true },
    });
    if (!admin) {
      await prisma.user.create({
        data: {
          tenantId: tenant.id,
          email: LOGIN_ID,
          passwordHash,
          name: TENANT_NAME,
          role: 'ADMIN',
          isTenantOwner: true,
          isActive: true,
          phone: CONTACT_PHONE,
          recoveryEmail: CONTACT_EMAIL,
          profileCompletedAt: new Date(),
        },
      });
    }
  }

  await seedTenantDefaults(prisma, tenant.id, TENANT_NAME);
  await ensureDefaultAdChannelsForTenant(prisma, tenant.id);

  const current = await prisma.tenant.findUnique({
    where: { id: tenant.id },
    select: { config: true },
  });
  const cfg = (current?.config && typeof current.config === 'object' ? current.config : {}) as Record<
    string,
    unknown
  >;
  await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      config: {
        ...cfg,
        branding: { displayName: TENANT_NAME, loginSubtitle: '1인 사업자 테스트' },
        inquiry: { numberPrefix: 'TS' },
        companyRegistration,
      } as Prisma.InputJsonValue,
    },
  });

  const oc = await prisma.operatingCompany.findFirst({
    where: { tenantId: tenant.id, isDefault: true },
    select: { id: true, config: true },
  });
  if (oc) {
    const merged = mergeOperatingCompanyConfig(
      parseOperatingCompanyConfig(oc.config),
      { companyRegistration },
      tenant.id,
    );
    await prisma.operatingCompany.update({
      where: { id: oc.id },
      data: {
        name: TENANT_NAME,
        config: operatingCompanyConfigToJson(merged) as Prisma.InputJsonValue,
      },
    });
  }

  const signupExisting = await prisma.tenantSignupBusiness.findUnique({
    where: { tenantId: tenant.id },
    select: { id: true },
  });
  if (signupExisting) {
    await prisma.tenantSignupBusiness.update({
      where: { tenantId: tenant.id },
      data: {
        businessType: 'registered_business',
        bizNumber: BIZ_NO_DIGITS,
        businessName: TENANT_NAME,
        representativeName: TENANT_NAME,
        addressLine: ADDRESS,
        businessRegistrationImageUrl: BIZ_IMAGE_URL,
        individualConfirmedAt: null,
        individualUsageNote: null,
        submittedAt: new Date(),
      },
    });
  } else {
    await createTenantSignupBusiness(prisma, {
      tenantId: tenant.id,
      businessType: 'registered_business',
      bizNumber: BIZ_NO,
      businessName: TENANT_NAME,
      representativeName: TENANT_NAME,
      addressLine: ADDRESS,
      businessRegistrationImageUrl: BIZ_IMAGE_URL,
    });
  }

  const billingStart = new Date();
  billingStart.setUTCHours(0, 0, 0, 0);
  await prisma.tenantBillingProfile.upsert({
    where: { tenantId: tenant.id },
    update: {
      billingCycle: 'MONTHLY',
      pricingMode: 'CATALOG',
      contractMemo: '운영 1인 사업자 테스트 (ts / Free)',
    },
    create: {
      tenantId: tenant.id,
      billingCycle: 'MONTHLY',
      pricingMode: 'CATALOG',
      billingStartDate: billingStart,
      contractMemo: '운영 1인 사업자 테스트 (ts / Free)',
    },
  });

  const check = await prisma.tenant.findUnique({
    where: { slug: SLUG },
    select: {
      slug: true,
      name: true,
      plan: true,
      status: true,
      signupBusiness: {
        select: {
          businessType: true,
          bizNumber: true,
          businessName: true,
          representativeName: true,
          addressLine: true,
        },
      },
      features: { select: { moduleId: true }, orderBy: { moduleId: 'asc' } },
      users: {
        where: { email: LOGIN_ID },
        select: { email: true, name: true, role: true, phone: true },
      },
    },
  });
  console.info('[ok]', JSON.stringify(check, null, 2));
  console.info(`로그인: www.cbiseo.com  업체코드 ${SLUG} / 아이디 ${LOGIN_ID} / 비밀번호 ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
