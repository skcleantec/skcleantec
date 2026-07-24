/**
 * 스테이징 — 정보공유 장바구니(DRAFT) 테스트 5건 (연예인 이름·금액 상이)
 * 실행: cd server && npx tsx scripts/_seed-staging-marketplace-cart-celebs.ts
 */
import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { computeMarketplaceFeeAmounts } from '../src/lib/dbMarketplaceAmount.js';
import { allocateNextInquiryNumber } from '../src/modules/inquiries/inquiryNumber.js';
import { getDefaultOperatingCompanyId } from '../src/modules/operating-companies/operatingCompany.service.js';
import {
  DEFAULT_TENANT_ID,
  LEGACY_SK_TENANT_SLUG,
} from '../src/modules/tenants/tenant.constants.js';

const TAG = '[장바구니연예인테스트]';

const SAMPLES = [
  {
    inquiryId: 'f1000000-0000-4000-8000-000000000001',
    listingId: 'f2000000-0000-4000-8000-000000000001',
    customerName: '유재석',
    address: '서울 강남구 언주로 726',
    addressDetail: '101동 1802호',
    balance: 420_000,
    listingFee: 30_000,
  },
  {
    inquiryId: 'f1000000-0000-4000-8000-000000000002',
    listingId: 'f2000000-0000-4000-8000-000000000002',
    customerName: '아이유',
    address: '서울 용산구 한강대로 23',
    addressDetail: '2204호',
    balance: 580_000,
    listingFee: 50_000,
  },
  {
    inquiryId: 'f1000000-0000-4000-8000-000000000003',
    listingId: 'f2000000-0000-4000-8000-000000000003',
    customerName: '손흥민',
    address: '경기 성남시 분당구 판교역로 235',
    addressDetail: '3301호',
    balance: 650_000,
    listingFee: 70_000,
  },
  {
    inquiryId: 'f1000000-0000-4000-8000-000000000004',
    listingId: 'f2000000-0000-4000-8000-000000000004',
    customerName: '뷔',
    address: '서울 마포구 월드컵북로 400',
    addressDetail: '1502호',
    balance: 510_000,
    listingFee: 40_000,
  },
  {
    inquiryId: 'f1000000-0000-4000-8000-000000000005',
    listingId: 'f2000000-0000-4000-8000-000000000005',
    customerName: '김연아',
    address: '부산 해운대구 센텀중앙로 97',
    addressDetail: '2808호',
    balance: 890_000,
    listingFee: 100_000,
  },
] as const;

async function resolveSkTenantId() {
  const row = await prisma.tenant.findFirst({
    where: { OR: [{ id: DEFAULT_TENANT_ID }, { slug: LEGACY_SK_TENANT_SLUG }, { slug: 'sk' }] },
    select: { id: true, slug: true, name: true },
  });
  if (!row) throw new Error('SK(판매) 테넌트를 찾을 수 없습니다.');
  return row;
}

async function main() {
  const sk = await resolveSkTenantId();
  await prisma.tenantFeature.upsert({
    where: { tenantId_moduleId: { tenantId: sk.id, moduleId: 'mod_db_marketplace' } },
    update: { enabled: true },
    create: { tenantId: sk.id, moduleId: 'mod_db_marketplace', enabled: true },
  });

  const admin = await prisma.user.findFirst({
    where: { tenantId: sk.id, role: 'ADMIN', isActive: true },
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true },
  });
  if (!admin) throw new Error(`${sk.slug} ADMIN 계정 없음`);

  const ocId = await getDefaultOperatingCompanyId(prisma, sk.id);
  const preferredDate = new Date('2026-09-15T12:00:00+09:00');

  console.log(`판매 업체: ${sk.name} (${sk.slug})`);
  console.log(`태그: ${TAG}\n`);

  for (const s of SAMPLES) {
    const feeAmounts = computeMarketplaceFeeAmounts({
      listingFee: s.listingFee,
      priorFeesTotal: 0,
      customerBalanceAmount: s.balance,
    });

    await prisma.$transaction(async (tx) => {
      const inquiryNumber = await allocateNextInquiryNumber(tx, sk.id);
      await tx.inquiry.upsert({
        where: { id: s.inquiryId },
        update: {
          customerName: s.customerName,
          address: s.address,
          addressDetail: s.addressDetail,
          serviceTotalAmount: s.balance + 50_000,
          serviceDepositAmount: 50_000,
          serviceBalanceAmount: s.balance,
          status: 'RECEIVED',
          memo: `${TAG} ${s.customerName}`,
        },
        create: {
          id: s.inquiryId,
          tenantId: sk.id,
          operatingCompanyId: ocId,
          inquiryNumber,
          customerName: s.customerName,
          customerPhone: '010-7777-0001',
          address: s.address,
          addressDetail: s.addressDetail,
          areaPyeong: 33,
          propertyType: '아파트',
          preferredDate,
          preferredTime: '오후',
          status: 'RECEIVED',
          source: '전화',
          serviceTotalAmount: s.balance + 50_000,
          serviceDepositAmount: 50_000,
          serviceBalanceAmount: s.balance,
          createdById: admin.id,
          memo: `${TAG} ${s.customerName}`,
        },
      });

      await tx.inquiryDbListing.upsert({
        where: { inquiryId: s.inquiryId },
        update: {
          listingFee: feeAmounts.listingFee,
          priorFeesTotal: feeAmounts.priorFeesTotal,
          buyerTotalFee: feeAmounts.buyerTotalFee,
          displayAmount: feeAmounts.displayAmount,
          dealBalanceAmount: s.balance,
          status: 'DRAFT',
          visibility: 'ALL',
          publishedAt: null,
          hopIndex: 0,
          rootTenantId: sk.id,
          rootListingId: s.listingId,
        },
        create: {
          id: s.listingId,
          tenantId: sk.id,
          inquiryId: s.inquiryId,
          listingFee: feeAmounts.listingFee,
          priorFeesTotal: feeAmounts.priorFeesTotal,
          buyerTotalFee: feeAmounts.buyerTotalFee,
          displayAmount: feeAmounts.displayAmount,
          dealBalanceAmount: s.balance,
          status: 'DRAFT',
          visibility: 'ALL',
          hopIndex: 0,
          rootTenantId: sk.id,
          rootListingId: s.listingId,
        },
      });
    });

    console.log(
      `  ✓ ${s.customerName} — 잔금 ${s.balance.toLocaleString('ko-KR')}원 · 수수료 ${s.listingFee.toLocaleString('ko-KR')}원 (장바구니)`,
    );
  }

  console.log('\n정보공유 → 장바구니 탭에서 5건 확인하세요.');
  console.log(`(기존 ${TAG} 건은 upsert로 갱신됩니다)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
