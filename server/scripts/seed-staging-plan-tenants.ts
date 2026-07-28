/**
 * 스테이징 — 플랜별 데모 테넌트 4개 (Free·Standard·Standard+·Premium)
 * 사업자 정보(업체등록정보) 전 필드 + Premium은 영업 브랜드 2개
 *
 * 실행:
 *   cd server && npx tsx scripts/seed-staging-plan-tenants.ts
 *
 * server/.env 에 STAGING_DATABASE_URL 또는 SKCT_SOURCE_DATABASE_URL(스테이징 Proxy) 권장
 */
import 'dotenv/config';
import type { Prisma } from '@prisma/client';
import { prisma } from '../src/lib/prisma.js';
import {
  provisionTenant,
  resetTenantFeaturesFromPlan,
} from '../src/modules/platform/tenantProvisioning.service.js';
import { patchTenantCompanyProfile } from '../src/modules/tenants/tenantCompanyProfile.service.js';
import {
  createOperatingCompany,
  OperatingCompanyValidationError,
} from '../src/modules/operating-companies/operatingCompany.service.js';
import {
  mergeOperatingCompanyConfig,
  operatingCompanyConfigToJson,
  parseOperatingCompanyConfig,
} from '../src/modules/operating-companies/operatingCompany.schema.js';
import type { TenantCompanyRegistrationConfig } from '../src/modules/tenants/tenantConfig.schema.js';
import type { TenantPlanId } from '../src/modules/tenants/tenantFeatureCatalog.js';

const stagingUrl = (process.env.STAGING_DATABASE_URL ?? process.env.SKCT_SOURCE_DATABASE_URL ?? '').trim();
if (stagingUrl) {
  process.env.DATABASE_URL = stagingUrl;
}

const ADMIN_PASSWORD = '1234';

type PlanSpec = {
  slug: string;
  plan: TenantPlanId;
  name: string;
  companyName: string;
  businessRegistrationNo: string;
  contactEmail: string;
};

const PLAN_TENANTS: PlanSpec[] = [
  {
    slug: 'staging-free',
    plan: 'free',
    name: '(스테이징) Free 데모',
    companyName: '스테이징프리청소(주)',
    businessRegistrationNo: '101-81-91001',
    contactEmail: 'free-demo@staging.cbiseo.test',
  },
  {
    slug: 'staging-standard',
    plan: 'standard',
    name: '(스테이징) Standard 데모',
    companyName: '스테이징스탠다드청소(주)',
    businessRegistrationNo: '101-81-91002',
    contactEmail: 'standard-demo@staging.cbiseo.test',
  },
  {
    slug: 'staging-stdplus',
    plan: 'standard_plus',
    name: '(스테이징) Standard+ 데모',
    companyName: '스테이징스탠다드플러스청소(주)',
    businessRegistrationNo: '101-81-91003',
    contactEmail: 'stdplus-demo@staging.cbiseo.test',
  },
  {
    slug: 'staging-premium',
    plan: 'premium',
    name: '(스테이징) Premium 데모',
    companyName: '스테이징프리미엄청소(주)',
    businessRegistrationNo: '101-81-91004',
    contactEmail: 'premium-demo@staging.cbiseo.test',
  },
];

function companyRegistration(spec: PlanSpec): TenantCompanyRegistrationConfig {
  return {
    companyName: spec.companyName,
    representativeName: '김데모',
    businessRegistrationNo: spec.businessRegistrationNo,
    addressLine: '서울특별시 강남구 테헤란로 152, 8층 (스테이징 데모)',
    phone: '02-555-0100',
    fax: '02-555-0101',
    contactEmail: spec.contactEmail,
  };
}

async function syncDefaultOperatingCompanyRegistration(
  tenantId: string,
  reg: TenantCompanyRegistrationConfig,
): Promise<void> {
  const oc = await prisma.operatingCompany.findFirst({
    where: { tenantId, isDefault: true },
    select: { id: true, config: true },
  });
  if (!oc) return;

  const existing = parseOperatingCompanyConfig(oc.config);
  const merged = mergeOperatingCompanyConfig(
    existing,
    { companyRegistration: reg },
    tenantId,
  );
  await prisma.operatingCompany.update({
    where: { id: oc.id },
    data: { config: operatingCompanyConfigToJson(merged) as Prisma.InputJsonValue },
  });
}

async function ensurePremiumSecondBrand(tenantId: string, spec: PlanSpec): Promise<void> {
  const existing = await prisma.operatingCompany.findFirst({
    where: { tenantId, slug: 'premium-extra' },
    select: { id: true },
  });
  if (existing) return;

  const reg: TenantCompanyRegistrationConfig = {
    companyName: `${spec.companyName} 부산지점`,
    representativeName: '이브랜드',
    businessRegistrationNo: '101-81-91005',
    addressLine: '부산광역시 해운대구 센텀로 100, 12층',
    phone: '051-555-0200',
    fax: '051-555-0201',
    contactEmail: 'premium-extra@staging.cbiseo.test',
  };

  try {
    await createOperatingCompany(prisma, tenantId, {
      name: '프리미엄 추가브랜드',
      slug: 'premium-extra',
      isActive: true,
      sortOrder: 1,
      config: { companyRegistration: reg },
    });
    console.info(`  + 영업 브랜드 2번째 생성 (premium-extra)`);
  } catch (e) {
    if (e instanceof OperatingCompanyValidationError && e.message.includes('slug')) {
      return;
    }
    throw e;
  }
}

async function ensurePlanTenant(spec: PlanSpec): Promise<void> {
  let tenant = await prisma.tenant.findUnique({
    where: { slug: spec.slug },
    select: { id: true, slug: true, plan: true, status: true },
  });

  if (!tenant) {
    const created = await provisionTenant({
      slug: spec.slug,
      name: spec.name,
      plan: spec.plan,
      adminLoginId: 'admin',
      adminPassword: ADMIN_PASSWORD,
      adminName: '데모관리자',
      status: 'ACTIVE',
    });
    tenant = created.tenant;
    console.info(`[create] ${spec.slug} plan=${spec.plan} admin=admin / ${ADMIN_PASSWORD}`);
  } else {
    if (tenant.plan !== spec.plan || tenant.status !== 'ACTIVE') {
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { plan: spec.plan, status: 'ACTIVE', suspendedAt: null, suspendReason: null },
      });
      await resetTenantFeaturesFromPlan(tenant.id);
      console.info(`[update] ${spec.slug} plan=${spec.plan} status=ACTIVE`);
    } else {
      console.info(`[exists] ${spec.slug} plan=${spec.plan}`);
    }
  }

  const reg = companyRegistration(spec);
  await patchTenantCompanyProfile(tenant.id, { companyRegistration: reg });
  await syncDefaultOperatingCompanyRegistration(tenant.id, reg);

  const billingStart = new Date();
  billingStart.setUTCHours(0, 0, 0, 0);
  await prisma.tenantBillingProfile.upsert({
    where: { tenantId: tenant.id },
    update: {
      billingCycle: 'MONTHLY',
      pricingMode: 'CATALOG',
      billingDueDay: 25,
      billingStartDate: billingStart,
      autoIssueEnabled: false,
      contractMemo: `스테이징 ${spec.plan} 플랜 데모 (seed-staging-plan-tenants)`,
    },
    create: {
      tenantId: tenant.id,
      billingCycle: 'MONTHLY',
      pricingMode: 'CATALOG',
      billingDueDay: 25,
      billingStartDate: billingStart,
      autoIssueEnabled: false,
      contractMemo: `스테이징 ${spec.plan} 플랜 데모 (seed-staging-plan-tenants)`,
    },
  });

  if (spec.plan === 'premium') {
    await ensurePremiumSecondBrand(tenant.id, spec);
  }

  console.info(`  사업자: ${reg.companyName} · ${reg.businessRegistrationNo}`);
}

async function main() {
  const dbUrl = process.env.DATABASE_URL ?? '';
  if (!dbUrl || dbUrl.includes('localhost')) {
    console.warn(
      '[warn] DATABASE_URL이 localhost입니다. STAGING_DATABASE_URL 설정을 권장합니다. 계속 진행합니다…',
    );
  }

  console.info('=== seed-staging-plan-tenants ===');
  for (const spec of PLAN_TENANTS) {
    await ensurePlanTenant(spec);
  }

  console.info('\n로그인 (업체코드 / 아이디 / 비밀번호):');
  for (const spec of PLAN_TENANTS) {
    console.info(`  ${spec.slug} / admin / ${ADMIN_PASSWORD}  (${spec.plan})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
