/**
 * Phase 5 — isTenantOwner·공개 링크 tenant 검증·WS composite key
 * 실행: cd server && npx tsx scripts/verify-multitenant-phase5.ts
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { DEFAULT_TENANT_SLUG } from '../src/modules/tenants/tenant.constants.js';
import { userSocketKey } from '../src/modules/realtime/realtimeHub.js';

const API = process.env.VERIFY_API_BASE ?? 'http://127.0.0.1:3000/api';

const VERIFY_TENANT_ID = 'b0000000-0000-4000-8000-000000000003';
const VERIFY_TENANT_SLUG = 'verify-p5-co';
const PASSWORD = 'verify-mt-p5-1234';
const OWNER_EMAIL = 'mt-p5-owner@internal';
const STAFF_ADMIN_EMAIL = 'mt-p5-staff@internal';

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

async function getMe(token: string) {
  const res = await fetch(`${API}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await res.json().catch(() => ({}))) as {
    isTenantOwner?: boolean;
    isSuperAdmin?: boolean;
    error?: string;
  };
  if (!res.ok) throw new Error(`me failed: ${body.error ?? res.status}`);
  return body;
}

async function ensureUsers(): Promise<{ ownerId: string }> {
  const hash = await bcrypt.hash(PASSWORD, 10);

  await prisma.tenant.upsert({
    where: { id: VERIFY_TENANT_ID },
    update: { status: 'ACTIVE' },
    create: {
      id: VERIFY_TENANT_ID,
      slug: VERIFY_TENANT_SLUG,
      name: 'Phase5 검증 업체',
      plan: 'starter',
      status: 'ACTIVE',
    },
  });

  const owner = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: VERIFY_TENANT_ID, email: OWNER_EMAIL } },
    update: { passwordHash: hash, isActive: true, role: 'ADMIN', name: 'P5 Owner', isTenantOwner: true },
    create: {
      tenantId: VERIFY_TENANT_ID,
      email: OWNER_EMAIL,
      passwordHash: hash,
      name: 'P5 Owner',
      role: 'ADMIN',
      isTenantOwner: true,
    },
    select: { id: true },
  });

  await prisma.user.upsert({
    where: { tenantId_email: { tenantId: VERIFY_TENANT_ID, email: STAFF_ADMIN_EMAIL } },
    update: { passwordHash: hash, isActive: true, role: 'ADMIN', name: 'P5 Staff', isTenantOwner: false },
    create: {
      tenantId: VERIFY_TENANT_ID,
      email: STAFF_ADMIN_EMAIL,
      passwordHash: hash,
      name: 'P5 Staff',
      role: 'ADMIN',
      isTenantOwner: false,
    },
  });

  await prisma.tenantFeature.upsert({
    where: { tenantId_moduleId: { tenantId: VERIFY_TENANT_ID, moduleId: 'mod_advertising' } },
    update: { enabled: true },
    create: { tenantId: VERIFY_TENANT_ID, moduleId: 'mod_advertising', enabled: true },
  });

  return { ownerId: owner.id };
}

async function main() {
  console.info('[verify-multitenant-phase5] start');

  assert(
    userSocketKey('user-uuid', VERIFY_TENANT_ID) === `${VERIFY_TENANT_ID}:user-uuid`,
    'WS composite key format',
  );
  assert(userSocketKey('crew:abc') === 'crew:abc', 'crew key unchanged');

  const { ownerId } = await ensureUsers();

  const ownerToken = await login(VERIFY_TENANT_SLUG, OWNER_EMAIL, PASSWORD);
  const staffToken = await login(VERIFY_TENANT_SLUG, STAFF_ADMIN_EMAIL, PASSWORD);

  const ownerMe = await getMe(ownerToken);
  assert(ownerMe.isTenantOwner === true, 'owner /me isTenantOwner');
  assert(ownerMe.isSuperAdmin === true, 'owner /me isSuperAdmin compat');

  const staffMe = await getMe(staffToken);
  assert(staffMe.isTenantOwner === false, 'staff admin /me isTenantOwner false');
  assert(staffMe.isSuperAdmin === false, 'staff admin /me isSuperAdmin false');

  const reorderRes = await fetch(`${API}/advertising/channels/reorder`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${staffToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ orderedIds: ['dummy-id'] }),
  });
  assert(reorderRes.status === 403, `non-owner reorder blocked (${reorderRes.status})`);

  const channel = await prisma.adChannel.findFirst({
    where: { tenantId: VERIFY_TENANT_ID },
    select: { id: true },
  });
  if (!channel) {
    await prisma.adChannel.create({
      data: { tenantId: VERIFY_TENANT_ID, name: 'P5 verify', sortOrder: 0, isActive: true },
    });
  }
  const channelId =
    channel?.id ??
    (
      await prisma.adChannel.findFirstOrThrow({
        where: { tenantId: VERIFY_TENANT_ID },
        select: { id: true },
      })
    ).id;

  const ownerReorder = await fetch(`${API}/advertising/channels/reorder`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${ownerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ orderedIds: [channelId] }),
  });
  assert(ownerReorder.ok, `owner reorder allowed (${ownerReorder.status})`);

  const publicToken = `p5-public-${Date.now()}`;
  await prisma.orderForm.create({
    data: {
      tenantId: VERIFY_TENANT_ID,
      token: publicToken,
      customerName: '[P5] 공개 발주',
      customerPhone: '010-0000-0001',
      totalAmount: 50000,
      balanceAmount: 30000,
      createdById: ownerId,
    },
  });

  const wrongSlugRes = await fetch(
    `${API}/orderforms/by-token/${publicToken}?tenant=${DEFAULT_TENANT_SLUG}`,
  );
  assert(wrongSlugRes.status === 404, 'public order wrong tenant slug → 404');

  const okRes = await fetch(`${API}/orderforms/by-token/${publicToken}?tenant=${VERIFY_TENANT_SLUG}`);
  assert(okRes.ok, 'public order matching tenant slug → 200');

  await prisma.tenant.update({
    where: { id: VERIFY_TENANT_ID },
    data: { status: 'SUSPENDED' },
  });

  const suspendedRes = await fetch(`${API}/orderforms/by-token/${publicToken}`);
  assert(suspendedRes.status === 403, 'suspended tenant public order → 403');

  await prisma.tenant.update({
    where: { id: VERIFY_TENANT_ID },
    data: { status: 'ACTIVE' },
  });

  console.info('[verify-multitenant-phase5] OK');
}

main()
  .catch((e) => {
    console.error('[verify-multitenant-phase5] FAIL', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
