/**
 * Phase 3 플랫폼 콘솔 검증 — starter 업체 생성 → premium 모듈 미노출
 * 실행: cd server && npx tsx scripts/verify-multitenant-phase3.ts
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const API = process.env.VERIFY_API_BASE ?? 'http://127.0.0.1:3000/api';
const PLATFORM_EMAIL = (process.env.PLATFORM_ADMIN_EMAIL ?? 'pyo').trim().toLowerCase();
const PLATFORM_PASSWORD = process.env.PLATFORM_ADMIN_PASSWORD ?? 'verify-mt-1234';

const prisma = new PrismaClient();

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERT: ${message}`);
}

async function platformLogin(): Promise<string> {
  const res = await fetch(`${API}/platform/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: PLATFORM_EMAIL, password: PLATFORM_PASSWORD }),
  });
  const body = (await res.json().catch(() => ({}))) as { token?: string; error?: string };
  if (!res.ok || !body.token) {
    throw new Error(`platform login failed: ${body.error ?? res.status}`);
  }
  return body.token;
}

async function tenantLogin(slug: string, email: string, password: string): Promise<string> {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantSlug: slug, email, password }),
  });
  const body = (await res.json().catch(() => ({}))) as { token?: string; error?: string };
  if (!res.ok || !body.token) {
    throw new Error(`tenant login failed: ${body.error ?? res.status}`);
  }
  return body.token;
}

async function main() {
  console.log('=== Phase 3 플랫폼 콘솔 검증 ===\n');

  const hash = await bcrypt.hash(PLATFORM_PASSWORD, 10);
  await prisma.platformUser.upsert({
    where: { email: PLATFORM_EMAIL },
    update: { passwordHash: hash, isActive: true, role: 'SUPER_ADMIN', name: '플랫폼 검증' },
    create: {
      email: PLATFORM_EMAIL,
      passwordHash: hash,
      name: '플랫폼 검증',
      role: 'SUPER_ADMIN',
    },
  });

  const slug = `phase3-test-${Date.now().toString(36)}`;
  const adminEmail = 'admin';
  const adminPassword = 'phase3-test-pass';

  const platformToken = await platformLogin();
  console.log('✓ 플랫폼 로그인');

  const createRes = await fetch(`${API}/platform/tenants`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${platformToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      slug,
      name: `Phase3 검증 ${slug}`,
      plan: 'starter',
      adminEmail,
      adminPassword,
      adminName: '검증관리자',
      status: 'TRIAL',
    }),
  });
  const created = (await createRes.json()) as {
    tenant?: { id: string; slug: string; plan: string };
    error?: string;
  };
  if (!createRes.ok || !created.tenant) {
    throw new Error(`tenant create failed: ${created.error ?? createRes.status}`);
  }
  console.log(`✓ 업체 생성 (${slug}, plan=starter)`);

  const listRes = await fetch(`${API}/platform/tenants`, {
    headers: { Authorization: `Bearer ${platformToken}` },
  });
  const list = (await listRes.json()) as { items?: { slug: string }[] };
  assert(listRes.ok && list.items!.some((t) => t.slug === slug), '목록에 새 업체 없음');
  console.log('✓ GET /platform/tenants 목록');

  const detailRes = await fetch(`${API}/platform/tenants/${created.tenant.id}`, {
    headers: { Authorization: `Bearer ${platformToken}` },
  });
  const detail = (await detailRes.json()) as {
    features?: { moduleId: string; effective: boolean }[];
  };
  assert(detailRes.ok, '상세 조회 실패');
  const effectiveIds = detail.features!.filter((f) => f.effective).map((f) => f.moduleId);
  assert(effectiveIds.includes('core_inquiries'), 'starter core_inquiries 없음');
  assert(effectiveIds.includes('mod_db_marketplace'), 'starter에 mod_db_marketplace 없음');
  assert(!effectiveIds.includes('mod_advertising'), 'starter에 mod_advertising 노출');
  assert(!effectiveIds.includes('mod_payroll'), 'starter에 mod_payroll 노출');
  console.log('✓ 플랫폼 상세 — starter 모듈만 effective');

  const tenantToken = await tenantLogin(slug, adminEmail, adminPassword);
  const meRes = await fetch(`${API}/auth/me`, {
    headers: { Authorization: `Bearer ${tenantToken}` },
  });
  const me = (await meRes.json()) as { features?: string[]; tenant?: { plan?: string } };
  assert(meRes.ok, '/auth/me 실패');
  assert(me.tenant?.plan === 'starter', 'tenant plan starter 아님');
  assert(me.features!.includes('mod_db_marketplace'), 'starter tenant /me에 mod_db_marketplace 없음');
  assert(!me.features!.includes('mod_advertising'), 'tenant /me에 mod_advertising 포함');
  assert(!me.features!.includes('mod_cs'), 'starter tenant /me에 mod_cs 포함');
  console.log('✓ 테넌트 로그인 — starter features만');

  const adRes = await fetch(`${API}/advertising/channels`, {
    headers: { Authorization: `Bearer ${tenantToken}` },
  });
  assert(adRes.status === 403, `광고 API 403 기대, got ${adRes.status}`);
  console.log('✓ starter 테넌트 — 광고 API 403');

  console.log('\n=== Phase 3 검증 통과 ===');
}

main()
  .catch((e) => {
    console.error('\n=== Phase 3 검증 실패 ===');
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
