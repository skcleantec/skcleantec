/**
 * 정보공유(DB 마켓) 스테이징·QA용 테스트 데이터.
 * 판매: DEFAULT 테넌트(skcleanteck) · 구매: market-test-buyer 파트너 테넌트
 */
import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { computeMarketplaceDisplayAmount } from '../src/lib/dbMarketplaceAmount.js';
import {
  computeMarketplaceExpiresAt,
  computeMarketplaceHoldUntil,
} from '../src/lib/dbMarketplacePolicy.js';
import { allocateNextInquiryNumber } from '../src/modules/inquiries/inquiryNumber.js';
import {
  createDefaultOperatingCompanyForTenant,
  getDefaultOperatingCompanyId,
} from '../src/modules/operating-companies/operatingCompany.service.js';
import { DEFAULT_TENANT_ID, DEFAULT_TENANT_SLUG } from '../src/modules/tenants/tenant.constants.js';

export const DB_MARKETPLACE_TEST_TAG = '[정보공유마켓테스트]';

export const BUYER_TENANT_ID = 'c0000000-0000-4000-8000-000000000004';
export const BUYER_TENANT_SLUG = 'market-test-buyer';
export const BUYER_ADMIN_EMAIL = 'market-test-buyer@internal';
export const DB_MARKETPLACE_TEST_PASSWORD = 'MarketTest1234';

export const PARTNERSHIP_ID = 'p0000000-0000-4000-8000-000000000001';

const INQUIRY_IDS = {
  draft1: 'd0000000-0000-4000-8000-000000000001',
  draft2: 'd0000000-0000-4000-8000-000000000002',
  open1: 'd0000000-0000-4000-8000-000000000003',
  open2: 'd0000000-0000-4000-8000-000000000004',
  openSelected: 'd0000000-0000-4000-8000-000000000005',
  openHold: 'd0000000-0000-4000-8000-000000000006',
  openQna: 'd0000000-0000-4000-8000-000000000007',
  pendingSeller: 'd0000000-0000-4000-8000-000000000008',
  expired: 'd0000000-0000-4000-8000-000000000009',
} as const;

const LISTING_IDS = {
  draft1: 'l0000000-0000-4000-8000-000000000001',
  draft2: 'l0000000-0000-4000-8000-000000000002',
  open1: 'l0000000-0000-4000-8000-000000000003',
  open2: 'l0000000-0000-4000-8000-000000000004',
  openSelected: 'l0000000-0000-4000-8000-000000000005',
  openHold: 'l0000000-0000-4000-8000-000000000006',
  openQna: 'l0000000-0000-4000-8000-000000000007',
  pendingSeller: 'l0000000-0000-4000-8000-000000000008',
  expired: 'l0000000-0000-4000-8000-000000000009',
} as const;

type SampleInquiry = {
  id: string;
  customerName: string;
  address: string;
  addressDetail: string;
  balance: number;
  label: string;
};

const SAMPLES: SampleInquiry[] = [
  {
    id: INQUIRY_IDS.draft1,
    customerName: '김테스트',
    address: '서울 강남구 테헤란로 152',
    addressDetail: '101동 1201호',
    balance: 480_000,
    label: '장바구니-1',
  },
  {
    id: INQUIRY_IDS.draft2,
    customerName: '이샘플',
    address: '경기 성남시 분당구 판교역로 146',
    addressDetail: '2204호',
    balance: 620_000,
    label: '장바구니-2',
  },
  {
    id: INQUIRY_IDS.open1,
    customerName: '박구매',
    address: '인천 연수구 컨벤시아대로 204',
    addressDetail: '15층',
    balance: 550_000,
    label: '구매가능-1',
  },
  {
    id: INQUIRY_IDS.open2,
    customerName: '최마켓',
    address: '서울 송파구 올림픽로 300',
    addressDetail: '302동 805호',
    balance: 720_000,
    label: '구매가능-2',
  },
  {
    id: INQUIRY_IDS.openSelected,
    customerName: '정파트너',
    address: '서울 마포구 월드컵북로 396',
    addressDetail: '상가 2층',
    balance: 410_000,
    label: '파트너전용',
  },
  {
    id: INQUIRY_IDS.openHold,
    customerName: '강예약',
    address: '부산 해운대구 센텀중앙로 79',
    addressDetail: '1010호',
    balance: 890_000,
    label: '검토예약중',
  },
  {
    id: INQUIRY_IDS.openQna,
    customerName: '윤문의',
    address: '대구 수성구 달구벌대로 528',
    addressDetail: '1502호',
    balance: 530_000,
    label: 'Q&A있음',
  },
  {
    id: INQUIRY_IDS.pendingSeller,
    customerName: '조인계',
    address: '광주 서구 상무중앙로 61',
    addressDetail: '801호',
    balance: 660_000,
    label: '인계대기',
  },
  {
    id: INQUIRY_IDS.expired,
    customerName: '한만료',
    address: '대전 유성구 대학로 99',
    addressDetail: '503호',
    balance: 390_000,
    label: '만료-재게시',
  },
];

async function resolveOperatingCompanyId(prisma: PrismaClient, tenantId: string, tenantName: string, slug: string) {
  try {
    return await getDefaultOperatingCompanyId(prisma, tenantId);
  } catch {
    return createDefaultOperatingCompanyForTenant(prisma, tenantId, { name: tenantName, slug });
  }
}

async function ensureFeature(prisma: PrismaClient, tenantId: string): Promise<void> {
  await prisma.tenantFeature.upsert({
    where: { tenantId_moduleId: { tenantId, moduleId: 'mod_db_marketplace' } },
    update: { enabled: true },
    create: { tenantId, moduleId: 'mod_db_marketplace', enabled: true },
  });
}

export async function purgeDbMarketplaceTest(prisma: PrismaClient): Promise<number> {
  const inquiries = await prisma.inquiry.findMany({
    where: { memo: { contains: DB_MARKETPLACE_TEST_TAG } },
    select: { id: true },
  });
  const inquiryIds = inquiries.map((r) => r.id);
  if (inquiryIds.length === 0) return 0;

  const listings = await prisma.inquiryDbListing.findMany({
    where: { inquiryId: { in: inquiryIds } },
    select: { id: true },
  });
  const listingIds = listings.map((r) => r.id);

  if (listingIds.length > 0) {
    await prisma.inquiryDbListingMessage.deleteMany({ where: { listingId: { in: listingIds } } });
    await prisma.inquiryDbListingAudience.deleteMany({ where: { listingId: { in: listingIds } } });
    await prisma.inquiryDbListing.deleteMany({ where: { id: { in: listingIds } } });
  }

  await prisma.assignment.deleteMany({ where: { inquiryId: { in: inquiryIds } } });
  const deleted = await prisma.inquiry.deleteMany({ where: { id: { in: inquiryIds } } });
  return deleted.count;
}

export async function runDbMarketplaceTestSeed(prisma: PrismaClient): Promise<void> {
  const removed = await purgeDbMarketplaceTest(prisma);
  if (removed > 0) {
    console.log(`기존 정보공유 테스트 접수 삭제: ${removed}건`);
  }

  const hash = await bcrypt.hash(DB_MARKETPLACE_TEST_PASSWORD, 10);
  const now = new Date();

  await prisma.tenant.upsert({
    where: { id: BUYER_TENANT_ID },
    update: { slug: BUYER_TENANT_SLUG, name: '정보공유 테스트 구매업체', status: 'ACTIVE', plan: 'premium' },
    create: {
      id: BUYER_TENANT_ID,
      slug: BUYER_TENANT_SLUG,
      name: '정보공유 테스트 구매업체',
      status: 'ACTIVE',
      plan: 'premium',
    },
  });

  const sellerTenant = await prisma.tenant.findUniqueOrThrow({ where: { id: DEFAULT_TENANT_ID } });
  await ensureFeature(prisma, DEFAULT_TENANT_ID);
  await ensureFeature(prisma, BUYER_TENANT_ID);

  const sellerOcId = await resolveOperatingCompanyId(
    prisma,
    DEFAULT_TENANT_ID,
    sellerTenant.name,
    DEFAULT_TENANT_SLUG,
  );
  await resolveOperatingCompanyId(
    prisma,
    BUYER_TENANT_ID,
    '정보공유 테스트 구매업체',
    BUYER_TENANT_SLUG,
  );

  const sellerAdmin = await prisma.user.findFirst({
    where: { tenantId: DEFAULT_TENANT_ID, role: 'ADMIN', isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!sellerAdmin) {
    throw new Error('판매 테넌트(skcleanteck)에 ADMIN 계정이 없습니다.');
  }

  const buyerAdmin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: BUYER_TENANT_ID, email: BUYER_ADMIN_EMAIL } },
    update: { passwordHash: hash, isActive: true, role: 'ADMIN', name: '마켓테스트구매' },
    create: {
      tenantId: BUYER_TENANT_ID,
      email: BUYER_ADMIN_EMAIL,
      passwordHash: hash,
      name: '마켓테스트구매',
      role: 'ADMIN',
    },
  });

  await prisma.tenantPartnership.upsert({
    where: { tenantLowId_tenantHighId: { tenantLowId: DEFAULT_TENANT_ID, tenantHighId: BUYER_TENANT_ID } },
    update: {
      status: 'ACTIVE',
      lowAcceptedAt: now,
      highAcceptedAt: now,
      suspendedAt: null,
      suspendedBy: null,
      memo: `${DB_MARKETPLACE_TEST_TAG} 파트너 연결`,
    },
    create: {
      id: PARTNERSHIP_ID,
      tenantLowId: DEFAULT_TENANT_ID,
      tenantHighId: BUYER_TENANT_ID,
      status: 'ACTIVE',
      requestedByTenantId: DEFAULT_TENANT_ID,
      lowAcceptedAt: now,
      highAcceptedAt: now,
      memo: `${DB_MARKETPLACE_TEST_TAG} 파트너 연결`,
    },
  });

  const listingFee = 50_000;
  const preferredDate = new Date('2026-08-15T12:00:00+09:00');

  for (const sample of SAMPLES) {
    const displayAmount = computeMarketplaceDisplayAmount(sample.balance, listingFee)!;
    await prisma.$transaction(async (tx) => {
      const inquiryNumber = await allocateNextInquiryNumber(tx, DEFAULT_TENANT_ID);
      await tx.inquiry.create({
        data: {
          id: sample.id,
          tenantId: DEFAULT_TENANT_ID,
          operatingCompanyId: sellerOcId,
          inquiryNumber,
          customerName: sample.customerName,
          customerPhone: '010-5555-0101',
          customerPhone2: '010-5555-0102',
          address: sample.address,
          addressDetail: sample.addressDetail,
          areaPyeong: 32,
          areaBasis: '전용',
          propertyType: '아파트',
          roomCount: 3,
          bathroomCount: 2,
          preferredDate,
          preferredTime: '오후',
          preferredTimeDetail: '14:00~17:00',
          status: 'RECEIVED',
          source: '전화',
          serviceTotalAmount: sample.balance + 20_000,
          serviceDepositAmount: 20_000,
          serviceBalanceAmount: sample.balance,
          createdById: sellerAdmin.id,
          memo: `${DB_MARKETPLACE_TEST_TAG} ${sample.label}`,
        },
      });
    });
  }

  const createListing = async (
    inquiryId: string,
    listingId: string,
    status: 'DRAFT' | 'OPEN' | 'PENDING_SELLER' | 'EXPIRED',
    extra: Record<string, unknown> = {},
  ) => {
    const inquiry = await prisma.inquiry.findUniqueOrThrow({ where: { id: inquiryId } });
    const displayAmount = computeMarketplaceDisplayAmount(inquiry.serviceBalanceAmount, listingFee)!;
    const publishedAt = status === 'DRAFT' ? null : new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    await prisma.inquiryDbListing.create({
      data: {
        id: listingId,
        tenantId: DEFAULT_TENANT_ID,
        inquiryId,
        listingFee,
        displayAmount,
        status,
        visibility: 'ALL',
        publishedAt,
        expiresAt: publishedAt ? computeMarketplaceExpiresAt(publishedAt) : null,
        ...extra,
      },
    });
  };

  await createListing(INQUIRY_IDS.draft1, LISTING_IDS.draft1, 'DRAFT');
  await createListing(INQUIRY_IDS.draft2, LISTING_IDS.draft2, 'DRAFT');

  await createListing(INQUIRY_IDS.open1, LISTING_IDS.open1, 'OPEN');
  await createListing(INQUIRY_IDS.open2, LISTING_IDS.open2, 'OPEN');

  await createListing(INQUIRY_IDS.openSelected, LISTING_IDS.openSelected, 'OPEN', { visibility: 'SELECTED' });
  await prisma.inquiryDbListingAudience.create({
    data: {
      id: randomUUID(),
      listingId: LISTING_IDS.openSelected,
      audienceKind: 'PARTNER_TENANT',
      partnerTenantId: BUYER_TENANT_ID,
    },
  });

  const holdUntil = computeMarketplaceHoldUntil(now);
  await createListing(INQUIRY_IDS.openHold, LISTING_IDS.openHold, 'OPEN', {
    holdBuyerKind: 'PARTNER_TENANT',
    holdBuyerTenantId: BUYER_TENANT_ID,
    holdByUserId: buyerAdmin.id,
    heldUntil: holdUntil,
  });

  await createListing(INQUIRY_IDS.openQna, LISTING_IDS.openQna, 'OPEN');
  await prisma.inquiryDbListingMessage.createMany({
    data: [
      {
        id: randomUUID(),
        tenantId: DEFAULT_TENANT_ID,
        listingId: LISTING_IDS.openQna,
        authorUserId: buyerAdmin.id,
        authorRole: 'BUYER',
        body: '현장 주차 가능한가요? 엘리베이터는 사용 가능한지 확인 부탁드립니다.',
      },
      {
        id: randomUUID(),
        tenantId: DEFAULT_TENANT_ID,
        listingId: LISTING_IDS.openQna,
        authorUserId: sellerAdmin.id,
        authorRole: 'SELLER',
        body: '주차 2시간 무료, 엘리베이터 사용 가능합니다. (테스트 답변)',
      },
    ],
  });

  await createListing(INQUIRY_IDS.pendingSeller, LISTING_IDS.pendingSeller, 'PENDING_SELLER', {
    buyerKind: 'PARTNER_TENANT',
    buyerTenantId: BUYER_TENANT_ID,
    buyerConfirmedAt: now,
    buyerConfirmedByUserId: buyerAdmin.id,
  });

  const expiredPublished = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000);
  await prisma.inquiryDbListing.create({
    data: {
      id: LISTING_IDS.expired,
      tenantId: DEFAULT_TENANT_ID,
      inquiryId: INQUIRY_IDS.expired,
      listingFee,
      displayAmount: computeMarketplaceDisplayAmount(
        SAMPLES.find((s) => s.id === INQUIRY_IDS.expired)!.balance,
        listingFee,
      )!,
      status: 'EXPIRED',
      visibility: 'ALL',
      publishedAt: expiredPublished,
      expiresAt: computeMarketplaceExpiresAt(expiredPublished),
      expiredAt: new Date(expiredPublished.getTime() + 31 * 24 * 60 * 60 * 1000),
    },
  });

  console.log('');
  console.log('=== 정보공유 마켓 테스트 데이터 ===');
  console.log(`태그: ${DB_MARKETPLACE_TEST_TAG}`);
  console.log('');
  console.log('【판매 — skcleanteck】');
  console.log(`  로그인: 기존 ADMIN (예: admin / 1234)`);
  console.log(`  메뉴: 정보공유 → 장바구니 2 · 구매가능 4 · 인계대기 1 · 만료 1`);
  console.log('');
  console.log('【구매 — market-test-buyer】');
  console.log(`  업체코드: ${BUYER_TENANT_SLUG}`);
  console.log(`  아이디: ${BUYER_ADMIN_EMAIL}`);
  console.log(`  비밀번호: ${DB_MARKETPLACE_TEST_PASSWORD}`);
  console.log('');
  console.log('【시나리오】');
  console.log('  · DRAFT 2건 — 장바구니 탭');
  console.log('  · OPEN 4건 — 구매 가능 (파트너전용 1 · 검토예약 1 · Q&A 1)');
  console.log('  · PENDING_SELLER 1건 — 판매자 인계 대기 / 구매자 구매 대기');
  console.log('  · EXPIRED 1건 — 다시 게시 테스트');
  console.log('');
  console.log(`파트너: ${DEFAULT_TENANT_SLUG} ↔ ${BUYER_TENANT_SLUG} (ACTIVE)`);
}
