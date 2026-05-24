/**
 * Phase 4 핵심 테이블 tenantId 격리 검증 — 발주서·C/S 크로스 접근 404
 * 실행: cd server && npx tsx scripts/verify-multitenant-phase4.ts
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { DEFAULT_TENANT_ID, DEFAULT_TENANT_SLUG } from '../src/modules/tenants/tenant.constants.js';

const API = process.env.VERIFY_API_BASE ?? 'http://127.0.0.1:3000/api';

const VERIFY_TENANT_ID = 'b0000000-0000-4000-8000-000000000002';
const VERIFY_TENANT_SLUG = 'verify-test-co';
const PASSWORD = 'verify-mt-1234';
const USER_A_EMAIL = 'mt-verify-a@internal';
const USER_B_EMAIL = 'mt-verify-b@internal';
const MARKER_A = '[MT-P4-A]';
const MARKER_B = '[MT-P4-B]';

const prisma = new PrismaClient();

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERT: ${message}`);
}

async function login(tenantSlug: string, email: string, password: string): Promise<string> {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantSlug, email, password }),
  });
  const body = (await res.json().catch(() => ({}))) as { token?: string; error?: string };
  if (!res.ok || !body.token) {
    throw new Error(`login failed (${tenantSlug}/${email}): ${body.error ?? res.status}`);
  }
  return body.token;
}

async function ensureVerifyUsers(): Promise<{ adminAId: string; adminBId: string }> {
  const hash = await bcrypt.hash(PASSWORD, 10);

  await prisma.tenant.upsert({
    where: { id: DEFAULT_TENANT_ID },
    update: {},
    create: {
      id: DEFAULT_TENANT_ID,
      slug: DEFAULT_TENANT_SLUG,
      name: 'SK클린텍',
      plan: 'premium',
      status: 'ACTIVE',
    },
  });

  await prisma.tenant.upsert({
    where: { id: VERIFY_TENANT_ID },
    update: {},
    create: {
      id: VERIFY_TENANT_ID,
      slug: VERIFY_TENANT_SLUG,
      name: '검증 테스트 업체',
      plan: 'starter',
      status: 'ACTIVE',
    },
  });

  const adminA = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: DEFAULT_TENANT_ID, email: USER_A_EMAIL } },
    update: { passwordHash: hash, isActive: true, role: 'ADMIN', name: '검증A' },
    create: {
      tenantId: DEFAULT_TENANT_ID,
      email: USER_A_EMAIL,
      passwordHash: hash,
      name: '검증A',
      role: 'ADMIN',
    },
    select: { id: true },
  });

  const adminB = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: VERIFY_TENANT_ID, email: USER_B_EMAIL } },
    update: { passwordHash: hash, isActive: true, role: 'ADMIN', name: '검증B' },
    create: {
      tenantId: VERIFY_TENANT_ID,
      email: USER_B_EMAIL,
      passwordHash: hash,
      name: '검증B',
      role: 'ADMIN',
    },
    select: { id: true },
  });

  return { adminAId: adminA.id, adminBId: adminB.id };
}

async function seedPhase4Fixtures(adminAId: string, adminBId: string) {
  const formA = await prisma.orderForm.create({
    data: {
      tenantId: DEFAULT_TENANT_ID,
      token: `p4-verify-a-${Date.now()}`,
      customerName: `${MARKER_A} 발주`,
      customerPhone: '010-1111-0001',
      totalAmount: 100000,
      balanceAmount: 80000,
      createdById: adminAId,
      submittedAt: new Date(),
    },
    select: { id: true },
  });

  const formB = await prisma.orderForm.create({
    data: {
      tenantId: VERIFY_TENANT_ID,
      token: `p4-verify-b-${Date.now()}`,
      customerName: `${MARKER_B} 발주`,
      customerPhone: '010-2222-0002',
      totalAmount: 100000,
      balanceAmount: 80000,
      createdById: adminBId,
      submittedAt: new Date(),
    },
    select: { id: true },
  });

  const csA = await prisma.csReport.create({
    data: {
      tenantId: DEFAULT_TENANT_ID,
      customerName: `${MARKER_A} C/S`,
      customerPhone: '010-1111-0003',
      content: `${MARKER_A} 검증`,
      imageUrls: [],
      status: 'RECEIVED',
    },
    select: { id: true },
  });

  const csB = await prisma.csReport.create({
    data: {
      tenantId: VERIFY_TENANT_ID,
      customerName: `${MARKER_B} C/S`,
      customerPhone: '010-2222-0004',
      content: `${MARKER_B} 검증`,
      imageUrls: [],
      status: 'RECEIVED',
    },
    select: { id: true },
  });

  return { formAId: formA.id, formBId: formB.id, csAId: csA.id, csBId: csB.id };
}

async function main() {
  console.log('=== Phase 4 tenantId 격리 검증 ===\n');
  console.log(`API: ${API}`);

  const health = await fetch(`${API}/health`);
  assert(health.ok, `API 헬스 실패 (${health.status}) — npm run dev 확인`);

  const { adminAId, adminBId } = await ensureVerifyUsers();
  const { formAId, formBId, csAId, csBId } = await seedPhase4Fixtures(adminAId, adminBId);
  console.log('시드: 발주서·C/S 테넌트별 1건씩 준비\n');

  const tokenA = await login(DEFAULT_TENANT_SLUG, USER_A_EMAIL, PASSWORD);
  const tokenB = await login(VERIFY_TENANT_SLUG, USER_B_EMAIL, PASSWORD);
  console.log('✓ 로그인');

  const listA = await fetch(`${API}/orderforms?limit=30&offset=0&datePreset=all`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert(listA.ok, `tenant A 발주서 목록 실패 (${listA.status})`);
  const bodyA = (await listA.json()) as { items: { id: string; customerName: string }[] };
  assert(!bodyA.items.some((i) => i.customerName.includes(MARKER_B)), 'tenant A 발주서 목록에 B 데이터 노출');
  assert(bodyA.items.some((i) => i.id === formAId), 'tenant A 발주서 목록에 A 데이터 없음');
  console.log('✓ 발주서 목록: 테넌트 격리');

  const crossFormB = await fetch(`${API}/orderforms/${formAId}/customer-submission`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert(crossFormB.status === 404, `tenant B가 A 발주서 조회 시 404 기대, got ${crossFormB.status}`);
  const crossFormA = await fetch(`${API}/orderforms/${formBId}/customer-submission`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert(crossFormA.status === 404, `tenant A가 B 발주서 조회 시 404 기대, got ${crossFormA.status}`);
  console.log('✓ 발주서 상세: 크로스 테넌트 404');

  const csListA = await fetch(`${API}/cs?limit=30&offset=0&datePreset=3months`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert(csListA.ok, `tenant A C/S 목록 실패 (${csListA.status})`);
  const csBodyA = (await csListA.json()) as { items: { id: string; customerName: string }[] };
  assert(!csBodyA.items.some((i) => i.customerName.includes(MARKER_B)), 'tenant A C/S 목록에 B 데이터 노출');
  console.log('✓ C/S 목록: 테넌트 격리');

  const crossCsB = await fetch(`${API}/cs/${csAId}`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert(crossCsB.status === 404, `tenant B가 A C/S 조회 시 404 기대, got ${crossCsB.status}`);
  const crossCsA = await fetch(`${API}/cs/${csBId}`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert(crossCsA.status === 404, `tenant A가 B C/S 조회 시 404 기대, got ${crossCsA.status}`);
  console.log('✓ C/S 상세: 크로스 테넌트 404');

  const ownCsA = await fetch(`${API}/cs/${csAId}`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert(ownCsA.status === 200, `tenant A 자체 C/S 조회 실패 (${ownCsA.status})`);
  console.log('✓ C/S 상세: 동일 테넌트 허용');

  console.log('\n=== Phase 4 검증 통과 ===');
}

main()
  .catch((e) => {
    console.error('\n=== Phase 4 검증 실패 ===');
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
