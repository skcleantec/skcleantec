/**
 * 스테이징 — 파트너 A·B 업체 생성 + SK(기본 테넌트)와 ACTIVE 파트너 연결
 * 실행: cd server && npx tsx scripts/ensure-staging-partners-ab.ts
 */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma.js';
import { seedTenantDefaults } from '../src/modules/tenants/tenantConfigSeed.service.js';
import { modulesForPlan } from '../src/modules/tenants/tenantFeatureCatalog.js';
import { assertValidTenantLoginId } from '../src/modules/auth/tenantLoginId.js';
import { ensureDefaultAdChannelsForTenant } from '../src/modules/advertising/defaultAdChannels.js';
import {
  DEFAULT_TENANT_ID,
  DEFAULT_TENANT_SLUG,
  LEGACY_SK_TENANT_SLUG,
} from '../src/modules/tenants/tenant.constants.js';
import { normalizeTenantPairId } from '../src/modules/tenant-partners/tenantPartnership.service.js';
import {
  createDefaultOperatingCompanyForTenant,
  getDefaultOperatingCompanyId,
} from '../src/modules/operating-companies/operatingCompany.service.js';

const STAGING_PASSWORD = '1234';

const PARTNER_SPECS = [
  { slug: 'partner-a', name: 'A업체(스테이징)', adminLoginId: 'admin-a' },
  { slug: 'partner-b', name: 'B업체(스테이징)', adminLoginId: 'admin-b' },
] as const;

const REQUIRED_FEATURES = ['mod_db_marketplace', 'mod_tenant_exchange'] as const;

async function resolveSkTenant() {
  const byId = await prisma.tenant.findUnique({
    where: { id: DEFAULT_TENANT_ID },
    select: { id: true, slug: true, name: true },
  });
  if (byId) return byId;

  for (const slug of [LEGACY_SK_TENANT_SLUG, DEFAULT_TENANT_SLUG]) {
    const row = await prisma.tenant.findUnique({
      where: { slug },
      select: { id: true, slug: true, name: true },
    });
    if (row) return row;
  }

  throw new Error(
    `SK 테넌트를 찾을 수 없습니다 (id=${DEFAULT_TENANT_ID}, slug=${LEGACY_SK_TENANT_SLUG}|${DEFAULT_TENANT_SLUG}).`,
  );
}

async function ensureFeatures(tenantId: string) {
  for (const moduleId of REQUIRED_FEATURES) {
    await prisma.tenantFeature.upsert({
      where: { tenantId_moduleId: { tenantId, moduleId } },
      update: { enabled: true },
      create: { tenantId, moduleId, enabled: true },
    });
  }
}

async function ensureOperatingCompany(tenantId: string, tenantName: string, slug: string) {
  try {
    await getDefaultOperatingCompanyId(prisma, tenantId);
  } catch {
    await createDefaultOperatingCompanyForTenant(prisma, tenantId, tenantName, slug);
  }
}

async function ensurePartnerTenant(spec: (typeof PARTNER_SPECS)[number]) {
  const existing = await prisma.tenant.findUnique({
    where: { slug: spec.slug },
    select: { id: true, slug: true, name: true, plan: true, status: true },
  });

  if (existing) {
    if (existing.plan !== 'premium' || existing.status !== 'ACTIVE') {
      await prisma.tenant.update({
        where: { id: existing.id },
        data: { plan: 'premium', status: 'ACTIVE' },
      });
    }
    await ensureFeatures(existing.id);
    await ensureOperatingCompany(existing.id, spec.name, spec.slug);
    console.info(`[partner-ab] 기존 테넌트: ${existing.slug} (${existing.name})`);
    return existing.id;
  }

  const adminLoginId = assertValidTenantLoginId(spec.adminLoginId);
  const passwordHash = await bcrypt.hash(STAGING_PASSWORD, 10);
  const planModules = modulesForPlan('premium');

  const tenantId = await prisma.$transaction(
    async (tx) => {
      const tenant = await tx.tenant.create({
        data: {
          slug: spec.slug,
          name: spec.name,
          plan: 'premium',
          status: 'ACTIVE',
        },
      });

      await tx.tenantBillingProfile.create({
        data: { tenantId: tenant.id, billingCycle: 'MONTHLY' },
      });

      const moduleSet = new Set([...planModules, ...REQUIRED_FEATURES]);
      for (const moduleId of moduleSet) {
        await tx.tenantFeature.create({
          data: { tenantId: tenant.id, moduleId, enabled: true },
        });
      }

      await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: adminLoginId,
          passwordHash,
          name: `${spec.name} 관리자`,
          role: 'ADMIN',
          isTenantOwner: true,
          isActive: true,
        },
      });

      await seedTenantDefaults(tx, tenant.id, tenant.name);
      await ensureDefaultAdChannelsForTenant(tx, tenant.id);

      return tenant.id;
    },
    { maxWait: 30_000, timeout: 120_000 },
  );

  await ensureOperatingCompany(tenantId, spec.name, spec.slug);
  console.info(`[partner-ab] 신규 생성: ${spec.slug} (${tenantId})`);
  return tenantId;
}

async function ensureActivePartnership(skTenantId: string, partnerId: string, label: string) {
  const { low, high } = normalizeTenantPairId(skTenantId, partnerId);
  const now = new Date();

  const row = await prisma.tenantPartnership.upsert({
    where: { tenantLowId_tenantHighId: { tenantLowId: low, tenantHighId: high } },
    update: {
      status: 'ACTIVE',
      lowAcceptedAt: now,
      highAcceptedAt: now,
      suspendedAt: null,
      suspendedBy: null,
      memo: `[스테이징] SK ↔ ${label}`,
    },
    create: {
      id: randomUUID(),
      tenantLowId: low,
      tenantHighId: high,
      status: 'ACTIVE',
      requestedByTenantId: skTenantId,
      lowAcceptedAt: now,
      highAcceptedAt: now,
      memo: `[스테이징] SK ↔ ${label}`,
    },
    include: {
      tenantLow: { select: { slug: true, name: true } },
      tenantHigh: { select: { slug: true, name: true } },
    },
  });

  const partner =
    row.tenantLowId === partnerId ? row.tenantLow : row.tenantHigh;
  const sk = row.tenantLowId === skTenantId ? row.tenantLow : row.tenantHigh;
  console.info(
    `[partner-ab] 파트너 ACTIVE: ${sk.slug}(${sk.name}) ↔ ${partner.slug}(${partner.name}) id=${row.id}`,
  );
}

async function main() {
  const dbHost = (() => {
    try {
      const u = new URL(process.env.DATABASE_URL ?? '');
      return u.hostname;
    } catch {
      return '(unknown)';
    }
  })();
  console.info(`[partner-ab] DATABASE host: ${dbHost}`);

  const sk = await resolveSkTenant();
  console.info(`[partner-ab] SK 테넌트: slug=${sk.slug} name=${sk.name} id=${sk.id}`);

  await ensureFeatures(sk.id);
  await ensureOperatingCompany(sk.id, sk.name, sk.slug);

  const partnerIds: string[] = [];
  for (const spec of PARTNER_SPECS) {
    const id = await ensurePartnerTenant(spec);
    partnerIds.push(id);
    await ensureActivePartnership(sk.id, id, spec.slug);
  }

  const hash = await bcrypt.hash(STAGING_PASSWORD, 10);
  for (const spec of PARTNER_SPECS) {
    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { slug: spec.slug },
      select: { id: true },
    });
    await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: 'admin' } },
      update: { passwordHash: hash, isActive: true, role: 'ADMIN', name: '관리자' },
      create: {
        tenantId: tenant.id,
        email: 'admin',
        passwordHash: hash,
        name: '관리자',
        role: 'ADMIN',
        isActive: true,
        isTenantOwner: true,
      },
    });
    console.info(`[partner-ab] 로그인 ${spec.slug} / admin / ${STAGING_PASSWORD}`);
  }

  console.info('\n[partner-ab] 완료 — 정보공유·재판매 테스트용 계정');
  console.info(`  SK: 업체코드 ${sk.slug}`);
  for (const spec of PARTNER_SPECS) {
    console.info(`  ${spec.name}: 업체코드 ${spec.slug} · 아이디 admin · 비밀번호 ${STAGING_PASSWORD}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
