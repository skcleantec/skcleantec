/**
 * Phase 6 — L1 config·Host→slug·custom module catalog
 * 실행: cd server && npx tsx scripts/verify-multitenant-phase6.ts
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { parseTenantConfig } from '../src/modules/tenants/tenantConfig.schema.js';
import { resolveTenantSlugFromHost } from '../src/modules/tenants/tenantHostResolve.js';

const API = process.env.VERIFY_API_BASE ?? 'http://127.0.0.1:3000/api';
const PLATFORM_EMAIL = (process.env.PLATFORM_ADMIN_EMAIL ?? 'pyo').trim().toLowerCase();
const PLATFORM_PASSWORD = process.env.PLATFORM_ADMIN_PASSWORD ?? 'verify-mt-1234';

const VERIFY_TENANT_ID = 'b0000000-0000-4000-8000-000000000004';
const VERIFY_TENANT_SLUG = 'verify-p6-co';

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
  if (!res.ok || !body.token) throw new Error(`platform login: ${body.error ?? res.status}`);
  return body.token;
}

async function main() {
  console.info('[verify-multitenant-phase6] start');

  assert(
    resolveTenantSlugFromHost('acme.app.example.com', {
      baseDomain: 'app.example.com',
      platformSubdomain: 'platform',
    }) === 'acme',
    'host subdomain → slug',
  );
  assert(
    resolveTenantSlugFromHost('platform.app.example.com', {
      baseDomain: 'app.example.com',
      platformSubdomain: 'platform',
    }) === null,
    'platform subdomain excluded',
  );

  const parsed = parseTenantConfig({
    branding: { displayName: '테스트' },
    orderForm: { publicSubtitle: '부제' },
    unknown: true,
  });
  assert(parsed.branding?.displayName === '테스트', 'config parse branding');
  assert(parsed.orderForm?.publicSubtitle === '부제', 'config parse orderForm');

  const hash = await bcrypt.hash(PLATFORM_PASSWORD, 10);
  await prisma.platformUser.upsert({
    where: { email: PLATFORM_EMAIL },
    update: { passwordHash: hash, isActive: true, role: 'SUPER_ADMIN', name: 'P6' },
    create: {
      email: PLATFORM_EMAIL,
      passwordHash: hash,
      name: 'P6',
      role: 'SUPER_ADMIN',
    },
  });

  await prisma.tenant.upsert({
    where: { id: VERIFY_TENANT_ID },
    update: { slug: VERIFY_TENANT_SLUG, name: 'Phase6 검증', status: 'ACTIVE' },
    create: {
      id: VERIFY_TENANT_ID,
      slug: VERIFY_TENANT_SLUG,
      name: 'Phase6 검증',
      plan: 'starter',
      status: 'ACTIVE',
    },
  });

  const platformToken = await platformLogin();

  const configRes = await fetch(`${API}/platform/tenants/${VERIFY_TENANT_ID}/config`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${platformToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      branding: { displayName: 'P6 업체', loginSubtitle: '환영합니다' },
    }),
  });
  assert(configRes.ok, `config PATCH (${configRes.status})`);
  const configBody = (await configRes.json()) as { config?: { branding?: { displayName?: string } } };
  assert(configBody.config?.branding?.displayName === 'P6 업체', 'config saved');

  const hostRes = await fetch(
    `${API}/tenant/resolve-host?host=${encodeURIComponent(`${VERIFY_TENANT_SLUG}.localhost`)}`,
  );
  assert(hostRes.ok, 'resolve-host API');
  const hostBody = (await hostRes.json()) as { slug?: string; resolved?: boolean };
  assert(hostBody.resolved === true && hostBody.slug === VERIFY_TENANT_SLUG, 'resolve-host slug match');

  const badConfig = await fetch(`${API}/platform/tenants/${VERIFY_TENANT_ID}/config`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${platformToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ inquiry: { numberPrefix: 'bad prefix!' } }),
  });
  assert(badConfig.status === 400, 'invalid config rejected');

  console.info('[verify-multitenant-phase6] OK');
}

main()
  .catch((e) => {
    console.error('[verify-multitenant-phase6] FAIL', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
