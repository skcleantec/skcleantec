/**
 * Phase 7 — per-tenant config seed·공개 발주서 tenant slug 검증
 * 실행: cd server && npx tsx scripts/verify-multitenant-phase7.ts
 * (로컬 API 서버 필요 — VERIFY_API_BASE, 기본 http://127.0.0.1:3000/api)
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { DEFAULT_TENANT_ID } from '../src/modules/tenants/tenant.constants.js';
import { seedTenantDefaults } from '../src/modules/tenants/tenantConfigSeed.service.js';

const API = process.env.VERIFY_API_BASE ?? 'http://127.0.0.1:3000/api';

const TENANT_A_ID = 'b0000000-0000-4000-8000-000000000007';
const TENANT_A_SLUG = 'verify-p7-a';
const TENANT_B_ID = 'b0000000-0000-4000-8000-000000000008';
const TENANT_B_SLUG = 'verify-p7-b';
const PASSWORD = 'verify-mt-p7-1234';
const ADMIN_A = 'mt-p7-a@internal';
const ADMIN_B = 'mt-p7-b@internal';

const prisma = new PrismaClient();

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERT: ${message}`);
}

async function login(tenantSlug: string, email: string): Promise<string> {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantSlug, email, password: PASSWORD }),
  });
  const body = (await res.json().catch(() => ({}))) as { token?: string; error?: string };
  if (!res.ok || !body.token) {
    throw new Error(`login failed (${tenantSlug}/${email}): ${body.error ?? res.status}`);
  }
  return body.token;
}

async function main() {
  console.info('[verify-multitenant-phase7] start');

  const hash = await bcrypt.hash(PASSWORD, 10);

  for (const [id, slug, email, name] of [
    [TENANT_A_ID, TENANT_A_SLUG, ADMIN_A, 'P7 A'] as const,
    [TENANT_B_ID, TENANT_B_SLUG, ADMIN_B, 'P7 B'] as const,
  ]) {
    await prisma.tenant.upsert({
      where: { id },
      update: { slug, name, status: 'ACTIVE' },
      create: { id, slug, name, plan: 'starter', status: 'ACTIVE' },
    });
    await prisma.user.upsert({
      where: { tenantId_email: { tenantId: id, email } },
      update: { passwordHash: hash, isActive: true, role: 'ADMIN', name },
      create: { tenantId: id, email, passwordHash: hash, name, role: 'ADMIN', isTenantOwner: true },
    });
    await seedTenantDefaults(prisma, id, name);
  }

  const cfgA = await prisma.orderFormConfig.findUnique({ where: { tenantId: TENANT_A_ID } });
  const cfgB = await prisma.orderFormConfig.findUnique({ where: { tenantId: TENANT_B_ID } });
  assert(!!cfgA && !!cfgB, 'both tenants have order form config');
  assert(cfgA!.id !== cfgB!.id, 'order form configs are distinct rows');
  assert(cfgA!.formTitle.includes('P7 A'), 'tenant A form title seeded');
  assert(cfgB!.formTitle.includes('P7 B'), 'tenant B form title seeded');

  const skCfg = await prisma.orderFormConfig.findUnique({ where: { tenantId: DEFAULT_TENANT_ID } });
  assert(!!skCfg, 'default SK tenant config exists');

  const tokenA = await login(TENANT_A_SLUG, ADMIN_A);
  const formConfigRes = await fetch(`${API}/orderforms/form-config`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert(formConfigRes.ok, 'tenant A form-config GET');
  const formConfigBody = (await formConfigRes.json()) as { formTitle?: string; tenantId?: string };
  assert(formConfigBody.formTitle?.includes('P7 A'), 'tenant A JWT sees own form config');

  const orderToken = randomBytes(16).toString('hex');
  await prisma.orderForm.create({
    data: {
      tenantId: TENANT_A_ID,
      token: orderToken,
      customerName: 'P7 테스트',
      totalAmount: 100000,
      depositAmount: 20000,
      balanceAmount: 80000,
      createdById: (await prisma.user.findFirst({
        where: { tenantId: TENANT_A_ID, email: ADMIN_A },
        select: { id: true },
      }))!.id,
    },
  });

  const okRes = await fetch(
    `${API}/orderforms/by-token/${orderToken}?tenant=${encodeURIComponent(TENANT_A_SLUG)}`,
  );
  assert(okRes.ok, 'by-token with matching tenant slug');

  const badRes = await fetch(
    `${API}/orderforms/by-token/${orderToken}?tenant=${encodeURIComponent(TENANT_B_SLUG)}`,
  );
  assert(badRes.status === 404, 'by-token with wrong tenant slug → 404');

  const publicInfo = await fetch(
    `${API}/tenant/public-info?slug=${encodeURIComponent(TENANT_A_SLUG)}`,
  );
  assert(publicInfo.ok, 'public-info API');
  const infoBody = (await publicInfo.json()) as { displayName?: string };
  assert(!!infoBody.displayName, 'public-info displayName');

  const profA = await prisma.professionalSpecialtyOption.count({ where: { tenantId: TENANT_A_ID } });
  const profB = await prisma.professionalSpecialtyOption.count({ where: { tenantId: TENANT_B_ID } });
  assert(profA >= 8 && profB >= 8, 'professional options seeded per tenant');

  console.info('[verify-multitenant-phase7] OK');
}

main()
  .catch((e) => {
    console.error('[verify-multitenant-phase7] FAIL', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
