/**
 * Phase 1 멀티테넌트 격리 검증 — 2 tenant + 로그인·접수 목록·크로스 접근
 * 실행: cd server && npx tsx scripts/verify-multitenant-phase1.ts
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import {
  createDefaultOperatingCompanyForTenant,
  getDefaultOperatingCompanyId,
} from '../src/modules/operating-companies/operatingCompany.service.js';
import { DEFAULT_TENANT_ID, DEFAULT_TENANT_SLUG } from '../src/modules/tenants/tenant.constants.js';

const API = process.env.VERIFY_API_BASE ?? 'http://127.0.0.1:3000/api';

const VERIFY_TENANT_ID = 'b0000000-0000-4000-8000-000000000002';
const VERIFY_TENANT_SLUG = 'verify-test-co';
const MARKER_A = '[MT-VERIFY-A]';
const MARKER_B = '[MT-VERIFY-B]';
const PASSWORD = 'verify-mt-1234';
const USER_A_EMAIL = 'mt-verify-a@internal';
const USER_B_EMAIL = 'mt-verify-b@internal';

const prisma = new PrismaClient();

type LoginResult = { token: string; tenantId: string; userId: string };

async function login(tenantSlug: string, email: string, password: string): Promise<LoginResult> {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantSlug, email, password }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    token?: string;
    tenant?: { id: string };
    user?: { id: string };
    error?: string;
  };
  if (!res.ok || !body.token) {
    throw new Error(`login failed (${tenantSlug}/${email}): ${res.status} ${body.error ?? res.statusText}`);
  }
  return {
    token: body.token,
    tenantId: body.tenant?.id ?? '',
    userId: body.user?.id ?? '',
  };
}

async function fetchInquiries(token: string): Promise<{ items: { id: string; customerName: string; memo: string | null }[]; total: number }> {
  const res = await fetch(`${API}/inquiries?limit=100&offset=0&datePreset=all`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await res.json().catch(() => ({}))) as {
    items?: { id: string; customerName: string; memo: string | null }[];
    total?: number;
    error?: string;
  };
  if (!res.ok) {
    throw new Error(`inquiries list failed: ${res.status} ${body.error ?? res.statusText}`);
  }
  return { items: body.items ?? [], total: body.total ?? 0 };
}

async function fetchInquiryById(token: string, id: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${API}/inquiries/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERT: ${message}`);
}

async function seedVerifyData(): Promise<{ inquiryAId: string; inquiryBId: string }> {
  const hash = await bcrypt.hash(PASSWORD, 10);

  const tenantA = await prisma.tenant.findUnique({ where: { id: DEFAULT_TENANT_ID } });
  assert(Boolean(tenantA), `기본 tenant(${DEFAULT_TENANT_SLUG}) 없음 — migrate deploy 확인`);

  const tenantB = await prisma.tenant.upsert({
    where: { slug: VERIFY_TENANT_SLUG },
    update: { name: '검증용 테스트업체', status: 'ACTIVE', plan: 'premium' },
    create: {
      id: VERIFY_TENANT_ID,
      slug: VERIFY_TENANT_SLUG,
      name: '검증용 테스트업체',
      status: 'ACTIVE',
      plan: 'premium',
    },
  });

  const adminA = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenantA!.id, email: USER_A_EMAIL } },
    update: { passwordHash: hash, isActive: true, role: 'ADMIN', name: '검증관리자A' },
    create: {
      tenantId: tenantA!.id,
      email: USER_A_EMAIL,
      passwordHash: hash,
      name: '검증관리자A',
      role: 'ADMIN',
    },
  });

  const adminB = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenantB.id, email: USER_B_EMAIL } },
    update: { passwordHash: hash, isActive: true, role: 'ADMIN', name: '검증관리자B' },
    create: {
      tenantId: tenantB.id,
      email: USER_B_EMAIL,
      passwordHash: hash,
      name: '검증관리자B',
      role: 'ADMIN',
      isTenantOwner: true,
    },
  });

  await createDefaultOperatingCompanyForTenant(prisma, tenantB.id, {
    name: '검증용 테스트업체',
    slug: VERIFY_TENANT_SLUG,
  });
  const ocAId = await getDefaultOperatingCompanyId(prisma, tenantA!.id);
  const ocBId = await getDefaultOperatingCompanyId(prisma, tenantB.id);

  const inquiryA = await prisma.inquiry.upsert({
    where: { tenantId_inquiryNumber: { tenantId: tenantA!.id, inquiryNumber: '999901' } },
    update: { customerName: `${MARKER_A} 고객`, memo: MARKER_A },
    create: {
      tenantId: tenantA!.id,
      operatingCompanyId: ocAId,
      inquiryNumber: '999901',
      createdById: adminA.id,
      customerName: `${MARKER_A} 고객`,
      customerPhone: '010-1111-0001',
      address: '서울 검증구 A로 1',
      memo: MARKER_A,
      source: '검증',
      status: 'RECEIVED',
    },
    select: { id: true },
  });

  const inquiryB = await prisma.inquiry.upsert({
    where: { tenantId_inquiryNumber: { tenantId: tenantB.id, inquiryNumber: '999902' } },
    update: { customerName: `${MARKER_B} 고객`, memo: MARKER_B },
    create: {
      tenantId: tenantB.id,
      operatingCompanyId: ocBId,
      inquiryNumber: '999902',
      createdById: adminB.id,
      customerName: `${MARKER_B} 고객`,
      customerPhone: '010-2222-0002',
      address: '서울 검증구 B로 2',
      memo: MARKER_B,
      source: '검증',
      status: 'RECEIVED',
    },
    select: { id: true },
  });

  return { inquiryAId: inquiryA.id, inquiryBId: inquiryB.id };
}

async function main() {
  console.log('=== Phase 1 멀티테넌트 격리 검증 ===\n');
  console.log(`API: ${API}`);

  const health = await fetch(`${API}/health`);
  assert(health.ok, `API 헬스 실패 (${health.status}) — npm run dev 확인`);

  const { inquiryAId, inquiryBId } = await seedVerifyData();
  console.log('시드: verify-test-co tenant + 검증 접수 2건 준비 완료\n');

  const sessionA = await login(DEFAULT_TENANT_SLUG, USER_A_EMAIL, PASSWORD);
  const sessionB = await login(VERIFY_TENANT_SLUG, USER_B_EMAIL, PASSWORD);

  assert(sessionA.tenantId === DEFAULT_TENANT_ID, 'tenant A JWT tenantId 불일치');
  assert(sessionB.tenantId === VERIFY_TENANT_ID, 'tenant B JWT tenantId 불일치');
  assert(sessionA.userId !== sessionB.userId, '동일 email이지만 userId가 달라야 함');
  console.log('✓ 로그인: tenantSlug별 admin 세션 분리');

  const listA = await fetchInquiries(sessionA.token);
  const listB = await fetchInquiries(sessionB.token);

  const aHasB = listA.items.some((i) => (i.memo ?? '').includes(MARKER_B) || i.customerName.includes(MARKER_B));
  const bHasA = listB.items.some((i) => (i.memo ?? '').includes(MARKER_A) || i.customerName.includes(MARKER_A));
  const aHasA = listA.items.some((i) => (i.memo ?? '').includes(MARKER_A));
  const bHasB = listB.items.some((i) => (i.memo ?? '').includes(MARKER_B));

  assert(!aHasB, 'tenant A 목록에 tenant B 검증 접수가 노출됨');
  assert(!bHasA, 'tenant B 목록에 tenant A 검증 접수가 노출됨');
  assert(aHasA, 'tenant A 목록에 검증 접수 A가 없음');
  assert(bHasB, 'tenant B 목록에 검증 접수 B가 없음');
  console.log('✓ 접수 목록: 테넌트 간 데이터 격리');

  const crossBtoA = await fetchInquiryById(sessionB.token, inquiryAId);
  const crossAtoB = await fetchInquiryById(sessionA.token, inquiryBId);
  assert(crossBtoA.status === 404, `tenant B가 A 접수 조회 시 404 기대, got ${crossBtoA.status}`);
  assert(crossAtoB.status === 404, `tenant A가 B 접수 조회 시 404 기대, got ${crossAtoB.status}`);
  console.log('✓ 상세: 크로스 테넌트 ID 접근 404');

  const ownA = await fetchInquiryById(sessionA.token, inquiryAId);
  const ownB = await fetchInquiryById(sessionB.token, inquiryBId);
  assert(ownA.status === 200, `tenant A 자체 접수 조회 실패 (${ownA.status})`);
  assert(ownB.status === 200, `tenant B 자체 접수 조회 실패 (${ownB.status})`);
  console.log('✓ 상세: 동일 테넌트 접근 허용');

  const wrongTenantLogin = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantSlug: VERIFY_TENANT_SLUG, email: USER_B_EMAIL, password: 'wrong-password' }),
  });
  assert(wrongTenantLogin.status === 401, '잘못된 비밀번호는 401');

  console.log('\n=== Phase 1 검증 통과 ===');
}

main()
  .catch((e) => {
    console.error('\n=== Phase 1 검증 실패 ===');
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
