/**
 * 스테이징 — SK 판매 + partner-a/b 구매 테스트용 OPEN listing 1건
 * 실행: cd server && npx tsx scripts/ensure-staging-marketplace-smoke.ts
 */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { prisma } from '../src/lib/prisma.js';
import { computeMarketplaceDisplayAmount } from '../src/lib/dbMarketplaceAmount.js';
import { computeMarketplaceExpiresAt } from '../src/lib/dbMarketplacePolicy.js';
import { allocateNextInquiryNumber } from '../src/modules/inquiries/inquiryNumber.js';
import { getDefaultOperatingCompanyId } from '../src/modules/operating-companies/operatingCompany.service.js';
import {
  DEFAULT_TENANT_ID,
  LEGACY_SK_TENANT_SLUG,
} from '../src/modules/tenants/tenant.constants.js';
import { normalizeTenantPairId } from '../src/modules/tenant-partners/tenantPartnership.service.js';

const TAG = '[스테이징정보공유테스트]';
const LISTING_FEE = 50_000;
const INQUIRY_ID = 'e0000000-0000-4000-8000-00000000a001';
const LISTING_ID = 'e0000000-0000-4000-8000-00000000b001';

async function resolveSkTenantId() {
  const row = await prisma.tenant.findFirst({
    where: { OR: [{ id: DEFAULT_TENANT_ID }, { slug: LEGACY_SK_TENANT_SLUG }, { slug: 'sk' }] },
    select: { id: true, slug: true, name: true },
  });
  if (!row) throw new Error('SK 테넌트 없음');
  return row;
}

async function ensureSkMarketplaceFeatures(tenantId: string) {
  for (const moduleId of ['mod_db_marketplace', 'mod_tenant_exchange'] as const) {
    await prisma.tenantFeature.upsert({
      where: { tenantId_moduleId: { tenantId, moduleId } },
      update: { enabled: true },
      create: { tenantId, moduleId, enabled: true },
    });
  }
}

async function main() {
  const sk = await resolveSkTenantId();
  await ensureSkMarketplaceFeatures(sk.id);

  const partners = await prisma.tenant.findMany({
    where: { slug: { in: ['partner-a', 'partner-b'] } },
    select: { id: true, slug: true, name: true },
  });
  if (partners.length < 2) {
    throw new Error('partner-a / partner-b 테넌트가 없습니다. ensure-staging-partners-ab.ts 먼저 실행하세요.');
  }

  for (const p of partners) {
    const { low, high } = normalizeTenantPairId(sk.id, p.id);
    const link = await prisma.tenantPartnership.findUnique({
      where: { tenantLowId_tenantHighId: { tenantLowId: low, tenantHighId: high } },
      select: { status: true },
    });
    if (link?.status !== 'ACTIVE') {
      throw new Error(`SK ↔ ${p.slug} 파트너가 ACTIVE가 아닙니다.`);
    }
    for (const moduleId of ['mod_db_marketplace', 'mod_tenant_exchange'] as const) {
      await prisma.tenantFeature.upsert({
        where: { tenantId_moduleId: { tenantId: p.id, moduleId } },
        update: { enabled: true },
        create: { tenantId: p.id, moduleId, enabled: true },
      });
    }
  }

  const balance = 550_000;
  const displayAmount = computeMarketplaceDisplayAmount(balance, LISTING_FEE)!;
  const now = new Date();
  const expiresAt = computeMarketplaceExpiresAt(now);
  const ocId = await getDefaultOperatingCompanyId(prisma, sk.id);

  await prisma.$transaction(async (tx) => {
    const inquiryNumber = await allocateNextInquiryNumber(tx, sk.id);
    await tx.inquiry.upsert({
      where: { id: INQUIRY_ID },
      update: {
        customerName: `${TAG} 김스테이징`,
        address: '서울 강남구 테헤란로 152',
        addressDetail: '스테이징 1201호',
        serviceBalanceAmount: balance,
        status: 'RECEIVED',
        memo: TAG,
      },
      create: {
        id: INQUIRY_ID,
        tenantId: sk.id,
        operatingCompanyId: ocId,
        inquiryNumber,
        customerName: `${TAG} 김스테이징`,
        customerPhone: '010-2000-3001',
        address: '서울 강남구 테헤란로 152',
        addressDetail: '스테이징 1201호',
        areaPyeong: 32,
        propertyType: '아파트',
        preferredDate: new Date('2026-09-01T12:00:00+09:00'),
        serviceBalanceAmount: balance,
        status: 'RECEIVED',
        memo: TAG,
      },
    });

    await tx.inquiryDbListing.upsert({
      where: { inquiryId: INQUIRY_ID },
      update: {
        listingFee: LISTING_FEE,
        displayAmount,
        status: 'OPEN',
        visibility: 'ALL',
        publishedAt: now,
        expiresAt,
        expiredAt: null,
        withdrawnAt: null,
        hopIndex: 0,
        rootTenantId: sk.id,
        rootListingId: LISTING_ID,
        dealBalanceAmount: balance,
      },
      create: {
        id: LISTING_ID,
        tenantId: sk.id,
        inquiryId: INQUIRY_ID,
        listingFee: LISTING_FEE,
        displayAmount,
        status: 'OPEN',
        visibility: 'ALL',
        publishedAt: now,
        expiresAt,
        hopIndex: 0,
        rootTenantId: sk.id,
        rootListingId: LISTING_ID,
        dealBalanceAmount: balance,
      },
    });
  });

  console.info('[smoke] SK OPEN listing 준비 완료');
  console.info(`  접수 ID: ${INQUIRY_ID}`);
  console.info(`  listing ID: ${LISTING_ID}`);
  console.info(`  표시금액: ${displayAmount.toLocaleString('ko-KR')}원 (잔금 ${balance.toLocaleString('ko-KR')} − 수수료 ${LISTING_FEE.toLocaleString('ko-KR')})`);
  console.info('\n[smoke] 테스트 순서 (스테이징 https://clean-solution-staging.up.railway.app)');
  console.info('  1) partner-a 로그인 — 업체코드 partner-a · admin · 1234');
  console.info('     → 정보공유 → 구매 가능 → 「스테이징정보공유테스트」 건 → 구매신청');
  console.info('  2) SK(sk) 로그인 → 정보공유 → 진행 중 → 인계 확정');
  console.info('  3) partner-a → 연계된 접수에서 재판매(장바구니) 또는 partner-b가 구매');
  console.info('  ※ 최신 정보공유 코드가 스테이징에 배포되어 있어야 재판매·회수 기능이 보입니다.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
