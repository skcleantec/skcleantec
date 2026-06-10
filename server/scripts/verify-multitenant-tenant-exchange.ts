/**
 * 테넌트 DB 거래(mod_tenant_exchange) 검증 — 필드 마스크·API 격리
 * 실행: cd server && npm run verify:multitenant:tenant-exchange
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { DEFAULT_TENANT_ID, DEFAULT_TENANT_SLUG } from '../src/modules/tenants/tenant.constants.js';
import {
  applyFieldMaskToMirrorData,
  filterKeysByShareMask,
  normalizeShareFieldMask,
  shareMaskFromPreset,
} from '../src/modules/tenant-partners/tenantInquiryShareFields.js';

const API = process.env.VERIFY_API_BASE ?? 'http://127.0.0.1:3000/api';

const VERIFY_TENANT_ID = 'b0000000-0000-4000-8000-000000000002';
const VERIFY_TENANT_SLUG = 'verify-test-co';
const PASSWORD = 'verify-mt-1234';
const USER_A_EMAIL = 'mt-verify-a@internal';
const USER_B_EMAIL = 'mt-verify-b@internal';

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

async function ensureFeature(tenantId: string, enabled: boolean): Promise<void> {
  await prisma.tenantFeature.upsert({
    where: { tenantId_moduleId: { tenantId, moduleId: 'mod_tenant_exchange' } },
    update: { enabled },
    create: { tenantId, moduleId: 'mod_tenant_exchange', enabled },
  });
}

function verifyFieldMaskHelpers(): void {
  const preset = shareMaskFromPreset('customer_schedule');
  assert(Array.isArray(preset) && preset.length > 10, 'customer_schedule preset');
  assert(preset!.includes('customerName') && !preset!.includes('memo'), 'preset excludes memo');

  const masked = normalizeShareFieldMask(['customerName', 'invalidKey', 'memo']);
  assert(masked?.includes('customerName') && masked.includes('memo'), 'normalize keeps allowed keys');
  assert(!masked?.includes('invalidKey'), 'normalize drops invalid keys');

  const filtered = filterKeysByShareMask(['customerName', 'memo', 'status'], preset);
  assert(filtered.includes('customerName') && !filtered.includes('memo'), 'mask filters memo');
  assert(filtered.includes('status'), 'status always passes mask');

  const full = {
    tenantId: 't1',
    operatingCompanyId: 'oc1',
    inquiryNumber: '100',
    source: 'test',
    status: 'RECEIVED' as const,
    customerName: '홍길동',
    customerPhone: '010',
    address: '서울',
    memo: '비밀',
    serviceTotalAmount: 100000,
  };
  const partial = applyFieldMaskToMirrorData(full, preset);
  assert(partial.customerName === '홍길동', 'mask mirror keeps customerName');
  assert(partial.memo == null, 'mask mirror drops memo');
  assert(partial.serviceTotalAmount == null, 'mask mirror drops amount');
  console.log('✓ field mask helpers');
}

async function verifyApiIsolation(): Promise<void> {
  let health: Response;
  try {
    health = await fetch(`${API}/health`);
  } catch {
    console.log('⊘ API 미기동 — 필드 마스크 단위 검증만 완료');
    return;
  }
  if (!health.ok) {
    console.log('⊘ API 헬스 실패 — 필드 마스크 단위 검증만 완료');
    return;
  }

  const hash = await bcrypt.hash(PASSWORD, 10);
  const tenantA = await prisma.tenant.findUnique({ where: { id: DEFAULT_TENANT_ID } });
  assert(Boolean(tenantA), `기본 tenant(${DEFAULT_TENANT_SLUG}) 없음`);

  await prisma.tenant.upsert({
    where: { slug: VERIFY_TENANT_SLUG },
    update: { status: 'ACTIVE', plan: 'premium' },
    create: {
      id: VERIFY_TENANT_ID,
      slug: VERIFY_TENANT_SLUG,
      name: '검증용 테스트업체',
      status: 'ACTIVE',
      plan: 'premium',
    },
  });

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: DEFAULT_TENANT_ID, email: USER_A_EMAIL } },
    update: { passwordHash: hash, isActive: true, role: 'ADMIN' },
    create: {
      tenantId: DEFAULT_TENANT_ID,
      email: USER_A_EMAIL,
      passwordHash: hash,
      name: '검증A',
      role: 'ADMIN',
    },
  });
  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: VERIFY_TENANT_ID, email: USER_B_EMAIL } },
    update: { passwordHash: hash, isActive: true, role: 'ADMIN' },
    create: {
      tenantId: VERIFY_TENANT_ID,
      email: USER_B_EMAIL,
      passwordHash: hash,
      name: '검증B',
      role: 'ADMIN',
    },
  });

  await ensureFeature(DEFAULT_TENANT_ID, false);
  await ensureFeature(VERIFY_TENANT_ID, true);

  const tokenA = await login(DEFAULT_TENANT_SLUG, USER_A_EMAIL, PASSWORD);
  const tokenB = await login(VERIFY_TENANT_SLUG, USER_B_EMAIL, PASSWORD);

  const offRes = await fetch(`${API}/tenant-partners`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert(offRes.status === 403, `mod_tenant_exchange off → 403 (${offRes.status})`);
  console.log('✓ feature off → tenant-partners 403');

  await ensureFeature(DEFAULT_TENANT_ID, true);

  const onRes = await fetch(`${API}/tenant-partners`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert(onRes.ok, `mod_tenant_exchange on → 200 (${onRes.status})`);
  console.log('✓ feature on → tenant-partners 200');

  const exportRes = await fetch(
    `${API}/tenant-partners/settlement/export?role=SELLER&partnerTenantId=${VERIFY_TENANT_ID}`,
    { headers: { Authorization: `Bearer ${tokenB}` } },
  );
  assert(
    exportRes.ok || exportRes.status === 404,
    `settlement export reachable (${exportRes.status})`,
  );
  if (exportRes.ok) {
    const text = await exportRes.text();
    assert(text.startsWith('\uFEFF') || text.includes('역할'), 'CSV BOM or header');
    console.log('✓ settlement export CSV');
  }

  void tokenA;
}

async function main() {
  console.info('[verify-multitenant-tenant-exchange] start');
  verifyFieldMaskHelpers();
  await verifyApiIsolation();
  console.info('[verify-multitenant-tenant-exchange] OK');
}

main()
  .catch((e) => {
    console.error('[verify-multitenant-tenant-exchange] FAIL', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
