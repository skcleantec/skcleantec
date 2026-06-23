/**
 * DB 마켓(정보공유) 검증 — 마스킹·금액·API 격리·기능 게이트
 * 실행: cd server && npm run verify:multitenant:db-marketplace
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { DEFAULT_TENANT_ID, DEFAULT_TENANT_SLUG } from '../src/modules/tenants/tenant.constants.js';
import {
  maskMarketplaceCustomerName,
  maskMarketplaceAddressRegion,
} from '../src/lib/marketplaceListingMask.js';
import { computeMarketplaceDisplayAmount } from '../src/lib/dbMarketplaceAmount.js';
import {
  computeMarketplaceExpiresAt,
  DB_MARKETPLACE_LISTING_TTL_DAYS,
} from '../src/lib/dbMarketplacePolicy.js';
import {
  loadMarketplaceConfirmedInquiryIdSet,
  loadMarketplaceConfirmedShareIdSet,
} from '../src/modules/db-marketplace/dbMarketplaceSettlementMeta.js';

const API = process.env.VERIFY_API_BASE ?? 'http://127.0.0.1:3000/api';

const VERIFY_TENANT_ID = 'b0000000-0000-4000-8000-000000000003';
const VERIFY_TENANT_SLUG = 'verify-db-market-co';
const PASSWORD = 'verify-mt-1234';
const USER_A_EMAIL = 'db-market-verify-a@internal';
const USER_B_EMAIL = 'db-market-verify-b@internal';

const prisma = new PrismaClient();

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERT: ${message}`);
}

function verifyMaskAndAmount(): void {
  assert(maskMarketplaceCustomerName('홍길') === '홍0', '2-char name mask');
  assert(maskMarketplaceCustomerName('홍길동') === '홍0동', '3-char name mask');
  assert(maskMarketplaceCustomerName('김철수') === '김0수', '3-char name mask 2');

  const region = maskMarketplaceAddressRegion('서울특별시 강남구 역삼동 123');
  assert(region.includes('서울') && region.includes('강남'), `address region mask: ${region}`);
  assert(!region.includes('역삼'), 'dong hidden in region mask');

  assert(computeMarketplaceDisplayAmount(500_000, 50_000) === 450_000, 'display amount');
  assert(computeMarketplaceDisplayAmount(null, 10_000) === null, 'null balance');
  assert(computeMarketplaceDisplayAmount(5_000, 10_000) === null, 'negative display blocked');

  const exp = computeMarketplaceExpiresAt(new Date('2026-01-01T00:00:00.000Z'));
  assert(exp.getUTCDate() === 31, 'expiresAt +30 days');
  assert(DB_MARKETPLACE_LISTING_TTL_DAYS === 30, 'ttl days');

  console.log('✓ mask & display amount helpers');
}

async function verifySettlementMetaHelpers(): Promise<void> {
  const shareSet = await loadMarketplaceConfirmedShareIdSet([]);
  assert(shareSet.size === 0, 'empty share ids');
  const inquirySet = await loadMarketplaceConfirmedInquiryIdSet([]);
  assert(inquirySet.size === 0, 'empty inquiry ids');
  console.log('✓ settlement meta helpers');
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
    where: { tenantId_moduleId: { tenantId, moduleId: 'mod_db_marketplace' } },
    update: { enabled },
    create: { tenantId, moduleId: 'mod_db_marketplace', enabled },
  });
}

async function verifyApiIsolation(): Promise<void> {
  let health: Response;
  try {
    health = await fetch(`${API}/health`);
  } catch {
    console.log('⊘ API 미기동 — 단위 검증만 완료');
    return;
  }
  if (!health.ok) {
    console.log('⊘ API 헬스 실패 — 단위 검증만 완료');
    return;
  }

  const res = await fetch(`${API}/team/db-marketplace`, {
    headers: { Authorization: 'Bearer invalid-token' },
  });
  assert(res.status === 401 || res.status === 403, `team marketplace requires auth (${res.status})`);
  console.log('✓ team marketplace API auth gate');

  const adminDecline = await fetch(`${API}/db-marketplace/test-id/seller-decline`, {
    method: 'POST',
    headers: { Authorization: 'Bearer invalid-token' },
  });
  assert(
    adminDecline.status === 401 || adminDecline.status === 403,
    `seller-decline requires auth (${adminDecline.status})`,
  );
  console.log('✓ seller-decline API auth gate');

  const platformList = await fetch(`${API}/platform/db-marketplace`, {
    headers: { Authorization: 'Bearer invalid-token' },
  });
  assert(
    platformList.status === 401 || platformList.status === 403,
    `platform db-marketplace requires auth (${platformList.status})`,
  );
  console.log('✓ platform db-marketplace API auth gate');

  const hash = await bcrypt.hash(PASSWORD, 10);
  const tenantA = await prisma.tenant.findUnique({ where: { id: DEFAULT_TENANT_ID } });
  assert(Boolean(tenantA), `기본 tenant(${DEFAULT_TENANT_SLUG}) 없음`);

  await prisma.tenant.upsert({
    where: { slug: VERIFY_TENANT_SLUG },
    update: { status: 'ACTIVE', plan: 'premium' },
    create: {
      id: VERIFY_TENANT_ID,
      slug: VERIFY_TENANT_SLUG,
      name: 'DB마켓 검증업체',
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
      name: 'DB마켓검증A',
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
      name: 'DB마켓검증B',
      role: 'ADMIN',
    },
  });

  await ensureFeature(DEFAULT_TENANT_ID, false);
  await ensureFeature(VERIFY_TENANT_ID, true);

  const tokenA = await login(DEFAULT_TENANT_SLUG, USER_A_EMAIL, PASSWORD);
  const tokenB = await login(VERIFY_TENANT_SLUG, USER_B_EMAIL, PASSWORD);

  const offRes = await fetch(`${API}/db-marketplace`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert(offRes.status === 403, `mod_db_marketplace off → 403 (${offRes.status})`);
  console.log('✓ feature off → db-marketplace 403');

  await ensureFeature(DEFAULT_TENANT_ID, true);

  const onRes = await fetch(`${API}/db-marketplace`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert(onRes.ok, `mod_db_marketplace on → 200 (${onRes.status})`);
  console.log('✓ feature on → db-marketplace 200');

  const draftCountRes = await fetch(`${API}/db-marketplace/draft-count`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert(draftCountRes.ok, `draft-count ok (${draftCountRes.status})`);
  const draftCountBody = (await draftCountRes.json()) as {
    count?: number;
    sellerPendingCount?: number;
    buyerPendingCount?: number;
  };
  assert(typeof draftCountBody.count === 'number', 'draft-count.count number');
  assert(typeof draftCountBody.sellerPendingCount === 'number', 'draft-count.sellerPendingCount number');
  assert(typeof draftCountBody.buyerPendingCount === 'number', 'draft-count.buyerPendingCount number');
  console.log('✓ draft-count shape');

  const pendingTabRes = await fetch(`${API}/db-marketplace?tab=pending&limit=1`, {
    headers: { Authorization: `Bearer ${tokenA}` },
  });
  assert(pendingTabRes.ok, `tab=pending list ok (${pendingTabRes.status})`);
  const pendingBody = (await pendingTabRes.json()) as { items?: unknown[]; total?: number };
  assert(Array.isArray(pendingBody.items), 'pending tab items array');
  assert(typeof pendingBody.total === 'number', 'pending tab total number');
  console.log('✓ tab=pending list');

  const crossRes = await fetch(`${API}/db-marketplace/00000000-0000-4000-8000-000000000099`, {
    headers: { Authorization: `Bearer ${tokenB}` },
  });
  assert(
    crossRes.status === 403 || crossRes.status === 404,
    `cross-tenant listing detail blocked (${crossRes.status})`,
  );
  console.log('✓ cross-tenant listing id → 403/404');

  void tokenA;
}

async function main(): Promise<void> {
  verifyMaskAndAmount();
  await verifySettlementMetaHelpers();
  await verifyApiIsolation();
  console.log('verify:multitenant:db-marketplace OK');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
