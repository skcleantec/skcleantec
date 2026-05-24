/**
 * Phase 2 기능 모듈 검증 — mod_advertising off → API 403
 * 실행: cd server && npx tsx scripts/verify-multitenant-phase2.ts
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const API = process.env.VERIFY_API_BASE ?? 'http://127.0.0.1:3000/api';
const VERIFY_TENANT_SLUG = 'verify-test-co';
const VERIFY_TENANT_ID = 'b0000000-0000-4000-8000-000000000002';
const USER_B_EMAIL = 'mt-verify-b@internal';
const PASSWORD = 'verify-mt-1234';

const prisma = new PrismaClient();

async function login(tenantSlug: string, email: string, password: string): Promise<string> {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantSlug, email, password }),
  });
  const body = (await res.json().catch(() => ({}))) as { token?: string; error?: string };
  if (!res.ok || !body.token) {
    throw new Error(`login failed: ${res.status} ${body.error ?? ''}`);
  }
  return body.token;
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERT: ${message}`);
}

async function main() {
  console.log('=== Phase 2 기능 모듈 검증 ===\n');

  const hash = await bcrypt.hash(PASSWORD, 10);
  await prisma.tenant.upsert({
    where: { slug: VERIFY_TENANT_SLUG },
    update: { plan: 'premium', status: 'ACTIVE' },
    create: {
      id: VERIFY_TENANT_ID,
      slug: VERIFY_TENANT_SLUG,
      name: '검증용 테스트업체',
      status: 'ACTIVE',
      plan: 'premium',
    },
  });
  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: VERIFY_TENANT_ID, email: USER_B_EMAIL } },
    update: { passwordHash: hash, isActive: true, role: 'ADMIN' },
    create: {
      tenantId: VERIFY_TENANT_ID,
      email: USER_B_EMAIL,
      passwordHash: hash,
      name: '검증관리자B',
      role: 'ADMIN',
    },
  });

  await prisma.tenantFeature.upsert({
    where: { tenantId_moduleId: { tenantId: VERIFY_TENANT_ID, moduleId: 'mod_advertising' } },
    update: { enabled: false },
    create: { tenantId: VERIFY_TENANT_ID, moduleId: 'mod_advertising', enabled: false },
  });

  const token = await login(VERIFY_TENANT_SLUG, USER_B_EMAIL, PASSWORD);

  const meRes = await fetch(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
  const me = (await meRes.json()) as { features?: string[] };
  assert(meRes.ok, '/auth/me 실패');
  assert(Array.isArray(me.features), 'features 배열 없음');
  assert(!me.features!.includes('mod_advertising'), 'mod_advertising가 features에 포함됨');
  console.log('✓ /auth/me — mod_advertising 제외');

  const capRes = await fetch(`${API}/tenant/capabilities`, { headers: { Authorization: `Bearer ${token}` } });
  const caps = (await capRes.json()) as { modules?: string[] };
  assert(capRes.ok, '/tenant/capabilities 실패');
  assert(!caps.modules!.includes('mod_advertising'), 'capabilities에 mod_advertising 포함');
  console.log('✓ GET /tenant/capabilities — mod_advertising off');

  const adRes = await fetch(`${API}/advertising/channels`, { headers: { Authorization: `Bearer ${token}` } });
  assert(adRes.status === 403, `광고 API 403 기대, got ${adRes.status}`);
  const adBody = (await adRes.json()) as { code?: string };
  assert(adBody.code === 'feature_disabled', 'feature_disabled 코드 기대');
  console.log('✓ GET /advertising/channels — 403 feature_disabled');

  console.log('\n=== Phase 2 검증 통과 ===');
}

main()
  .catch((e) => {
    console.error('\n=== Phase 2 검증 실패 ===');
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
