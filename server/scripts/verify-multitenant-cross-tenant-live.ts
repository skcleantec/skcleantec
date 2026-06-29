/**
 * 멀티테넌트 실전 격리 검증 — 공유 DB에서 두 테넌트 JWT로 크로스 접근·축하 feed API
 * cd server && npx tsx scripts/verify-multitenant-cross-tenant-live.ts
 */
import './loadServerEnv.js';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { PrismaClient } from '@prisma/client';
import {
  createDefaultOperatingCompanyForTenant,
  getDefaultOperatingCompanyId,
} from '../src/modules/operating-companies/operatingCompany.service.js';
import { DEFAULT_TENANT_ID, DEFAULT_TENANT_SLUG } from '../src/modules/tenants/tenant.constants.js';
import { getCelebrationFeedHeadId, listCelebrationFeedAfter, appendCelebrationToFeed } from '../src/modules/realtime/celebrationFeedStore.js';

const API = process.env.VERIFY_API_BASE ?? 'http://127.0.0.1:3000/api';
const VERIFY_TENANT_ID = 'b0000000-0000-4000-8000-000000000002';
const VERIFY_TENANT_SLUG = 'verify-test-co';
const PASSWORD = 'verify-mt-1234';
const USER_A = 'mt-verify-a@internal';
const USER_B = 'mt-verify-b@internal';

const prisma = new PrismaClient();

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`ASSERT: ${msg}`);
}

async function login(slug: string, email: string): Promise<{ token: string; tenantId: string }> {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantSlug: slug, email, password: PASSWORD }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    token?: string;
    tenant?: { id: string };
    error?: string;
  };
  if (!res.ok || !body.token || !body.tenant?.id) {
    throw new Error(`login ${slug}/${email}: ${body.error ?? res.status}`);
  }
  return { token: body.token, tenantId: body.tenant.id };
}

async function seed() {
  const hash = await bcrypt.hash(PASSWORD, 10);
  const tenantA = await prisma.tenant.findUnique({ where: { id: DEFAULT_TENANT_ID } });
  assert(Boolean(tenantA), 'DEFAULT tenant missing');

  const tenantB = await prisma.tenant.upsert({
    where: { slug: VERIFY_TENANT_SLUG },
    update: { status: 'ACTIVE', plan: 'premium' },
    create: {
      id: VERIFY_TENANT_ID,
      slug: VERIFY_TENANT_SLUG,
      name: 'Live 격리 검증',
      status: 'ACTIVE',
      plan: 'premium',
    },
  });

  const adminA = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: DEFAULT_TENANT_ID, email: USER_A } },
    update: { passwordHash: hash, isActive: true, role: 'ADMIN' },
    create: {
      tenantId: DEFAULT_TENANT_ID,
      email: USER_A,
      passwordHash: hash,
      name: 'LiveA',
      role: 'ADMIN',
    },
  });
  const adminB = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenantB.id, email: USER_B } },
    update: { passwordHash: hash, isActive: true, role: 'ADMIN', isTenantOwner: true },
    create: {
      tenantId: tenantB.id,
      email: USER_B,
      passwordHash: hash,
      name: 'LiveB',
      role: 'ADMIN',
      isTenantOwner: true,
    },
  });

  await createDefaultOperatingCompanyForTenant(prisma, tenantB.id, {
    name: 'Live 격리 검증',
    slug: VERIFY_TENANT_SLUG,
  });
  const ocA = await getDefaultOperatingCompanyId(prisma, DEFAULT_TENANT_ID);
  const ocB = await getDefaultOperatingCompanyId(prisma, tenantB.id);

  const inqA = await prisma.inquiry.upsert({
    where: { tenantId_inquiryNumber: { tenantId: DEFAULT_TENANT_ID, inquiryNumber: '999881' } },
    update: {
      customerName: '[LIVE-MT-A] 고객',
      operatingCompanyId: ocA,
      createdById: adminA.id,
      status: 'RECEIVED',
    },
    create: {
      tenantId: DEFAULT_TENANT_ID,
      operatingCompanyId: ocA,
      inquiryNumber: '999881',
      createdById: adminA.id,
      customerName: '[LIVE-MT-A] 고객',
      customerPhone: '010-1000-0001',
      address: '서울',
      source: 'live-verify',
      status: 'RECEIVED',
      createdAt: new Date(),
    },
    select: { id: true },
  });
  const inqB = await prisma.inquiry.upsert({
    where: { tenantId_inquiryNumber: { tenantId: tenantB.id, inquiryNumber: '999882' } },
    update: {
      customerName: '[LIVE-MT-B] 고객',
      operatingCompanyId: ocB,
      createdById: adminB.id,
      status: 'RECEIVED',
    },
    create: {
      tenantId: tenantB.id,
      operatingCompanyId: ocB,
      inquiryNumber: '999882',
      createdById: adminB.id,
      customerName: '[LIVE-MT-B] 고객',
      customerPhone: '010-2000-0002',
      address: '부산',
      source: 'live-verify',
      status: 'RECEIVED',
      createdAt: new Date(),
    },
    select: { id: true },
  });

  return { inqAId: inqA.id, inqBId: inqB.id, tenantBId: tenantB.id };
}

async function main() {
  console.info('[verify-multitenant-cross-tenant-live] start');
  assert((await fetch(`${API}/health`)).ok, 'API health');

  const { inqAId, inqBId, tenantBId } = await seed();
  const sessA = await login(DEFAULT_TENANT_SLUG, USER_A);
  const sessB = await login(VERIFY_TENANT_SLUG, USER_B);

  assert(sessA.tenantId === DEFAULT_TENANT_ID, 'JWT tenant A');
  assert(sessB.tenantId === tenantBId, 'JWT tenant B');

  const crossAB = await fetch(`${API}/inquiries/${inqBId}`, {
    headers: { Authorization: `Bearer ${sessA.token}` },
  });
  const crossBA = await fetch(`${API}/inquiries/${inqAId}`, {
    headers: { Authorization: `Bearer ${sessB.token}` },
  });
  assert(crossAB.status === 404 || crossAB.status === 403, `A→B inquiry ${crossAB.status}`);
  assert(crossBA.status === 404 || crossBA.status === 403, `B→A inquiry ${crossBA.status}`);
  console.info('✓ inquiry cross-tenant GET blocked');

  const ownA = await fetch(`${API}/inquiries/${inqAId}`, {
    headers: { Authorization: `Bearer ${sessA.token}` },
  });
  assert(ownA.ok, 'own inquiry A');
  console.info('✓ inquiry same-tenant GET ok');

  // celebration feed store (same module as GET /realtime/celebrations — 별 프로세스 in-memory 공유 불가)
  const headBefore = getCelebrationFeedHeadId();
  appendCelebrationToFeed({
    type: 'inquiry:celebrate',
    tenantId: DEFAULT_TENANT_ID,
    inquiryId: inqAId,
    registrarName: 'A',
    customerName: '[LIVE-MT-A]',
    inquiryNumber: 'LIVE-A',
    source: 'test',
  });
  appendCelebrationToFeed({
    type: 'inquiry:celebrate',
    tenantId: tenantBId,
    inquiryId: inqBId,
    registrarName: 'B',
    customerName: '[LIVE-MT-B]',
    inquiryNumber: 'LIVE-B',
    source: 'test',
  });
  const storeA = listCelebrationFeedAfter(headBefore, DEFAULT_TENANT_ID);
  const storeB = listCelebrationFeedAfter(headBefore, tenantBId);
  assert(storeA.some((x) => x.customerName.includes('LIVE-MT-A')), 'store A own event');
  assert(!storeA.some((x) => x.customerName.includes('LIVE-MT-B')), 'store A no B leak');
  assert(storeB.some((x) => x.customerName.includes('LIVE-MT-B')), 'store B own event');
  assert(!storeB.some((x) => x.customerName.includes('LIVE-MT-A')), 'store B no A leak');
  console.info('✓ celebration feed store tenant-filtered (API route uses same store + JWT tenant)');

  console.info('[verify-multitenant-cross-tenant-live] OK');
}

main()
  .catch((e) => {
    console.error('[verify-multitenant-cross-tenant-live] FAIL', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
