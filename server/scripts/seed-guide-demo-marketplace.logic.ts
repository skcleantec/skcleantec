/**
 * Phase 3 — 정보공유 DB 마켓 (A11)
 */
import type { PrismaClient } from '@prisma/client';
import { computeMarketplaceDisplayAmount } from '../src/lib/dbMarketplaceAmount.js';
import {
  computeMarketplaceExpiresAt,
  computeMarketplaceHoldUntil,
} from '../src/lib/dbMarketplacePolicy.js';
import { allocateNextInquiryNumber } from '../src/modules/inquiries/inquiryNumber.js';
import { addDaysToKstYmd, kstTodayYmd } from '../src/modules/inquiries/inquiryListDateRange.js';
import { getDefaultOperatingCompanyId } from '../src/modules/operating-companies/operatingCompany.service.js';
import { guideDemoTenantId } from './guide-demo/tenantScope.js';
import {
  GUIDE_DEMO_EXTERNAL_COMPANY_ID,
  GUIDE_DEMO_TAG,
  guideDemoMarketInquiryId,
  guideDemoMarketListingId,
} from './guide-demo/constants.js';
import { purgeGuideDemoMarketplaceSeed } from './guide-demo/purge.js';

const MARKET_TAG = `${GUIDE_DEMO_TAG} 마켓`;
const LISTING_FEE = 50_000;

function kstNoon(dayOffset: number): Date {
  const ymd = addDaysToKstYmd(kstTodayYmd(), dayOffset);
  return new Date(`${ymd}T12:00:00+09:00`);
}

export async function runGuideDemoMarketplaceSeed(
  prisma: PrismaClient,
): Promise<{ purged: number; listingCount: number }> {
  const purged = await purgeGuideDemoMarketplaceSeed(prisma);

  await prisma.tenantFeature.upsert({
    where: { tenantId_moduleId: { tenantId: guideDemoTenantId(), moduleId: 'mod_db_marketplace' } },
    update: { enabled: true },
    create: { tenantId: guideDemoTenantId(), moduleId: 'mod_db_marketplace', enabled: true },
  });

  const admin = await prisma.user.findFirst({
    where: { tenantId: guideDemoTenantId(), role: 'ADMIN', isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!admin) throw new Error('ADMIN 계정이 없습니다.');

  const operatingCompanyId = await getDefaultOperatingCompanyId(prisma, guideDemoTenantId());
  const now = new Date();

  const rows = [
    { n: 1, code: 'M-01', name: '마켓장바구니', balance: 480_000, status: 'DRAFT' as const },
    { n: 2, code: 'M-02', name: '마켓공개', balance: 620_000, status: 'OPEN' as const },
    { n: 3, code: 'M-03', name: '마켓만료임박', balance: 550_000, status: 'OPEN' as const, soonExpire: true },
    { n: 4, code: 'M-04', name: '마켓검토중', balance: 720_000, status: 'OPEN' as const, hold: true },
    { n: 5, code: 'M-05', name: '마켓인계대기', balance: 410_000, status: 'PENDING_SELLER' as const },
  ];

  for (const row of rows) {
    const inquiryId = guideDemoMarketInquiryId(row.n);
    const listingId = guideDemoMarketListingId(row.n);
    const preferredDate = kstNoon(14);

    await prisma.$transaction(async (tx) => {
      const inquiryNumber = await allocateNextInquiryNumber(tx, guideDemoTenantId());
      await tx.inquiry.create({
        data: {
          id: inquiryId,
          tenantId: guideDemoTenantId(),
          operatingCompanyId,
          inquiryNumber,
          customerName: row.name,
          customerPhone: `010-5${String(row.n).padStart(3, '0')}-1001`,
          address: '경기 성남시 분당구 판교역로 146',
          addressDetail: `${row.code} · ${row.status}`,
          areaPyeong: 32,
          propertyType: '아파트',
          roomCount: 3,
          bathroomCount: 2,
          preferredDate,
          preferredTime: '오후',
          status: 'RECEIVED',
          source: '전화',
          serviceTotalAmount: row.balance + 20_000,
          serviceDepositAmount: 20_000,
          serviceBalanceAmount: row.balance,
          createdById: admin.id,
          memo: `${MARKET_TAG} ${row.code}`,
        },
      });
    });

    const inquiry = await prisma.inquiry.findUniqueOrThrow({ where: { id: inquiryId } });
    const displayAmount = computeMarketplaceDisplayAmount(inquiry.serviceBalanceAmount, LISTING_FEE)!;
    const publishedAt =
      row.status === 'DRAFT' ? null : new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    let expiresAt = publishedAt ? computeMarketplaceExpiresAt(publishedAt) : null;
    if (row.soonExpire && publishedAt) {
      expiresAt = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
    }

    await prisma.inquiryDbListing.create({
      data: {
        id: listingId,
        tenantId: guideDemoTenantId(),
        inquiryId,
        listingFee: LISTING_FEE,
        displayAmount,
        status: row.status,
        visibility: 'ALL',
        publishedAt,
        expiresAt,
        ...(row.hold
          ? {
              holdBuyerKind: 'EXTERNAL_COMPANY' as const,
              holdBuyerExternalCompanyId: GUIDE_DEMO_EXTERNAL_COMPANY_ID,
              holdByUserId: admin.id,
              heldUntil: computeMarketplaceHoldUntil(now),
            }
          : {}),
        ...(row.status === 'PENDING_SELLER'
          ? {
              buyerKind: 'EXTERNAL_COMPANY' as const,
              buyerConfirmedAt: now,
              buyerConfirmedByUserId: admin.id,
            }
          : {}),
      },
    });
  }

  return { purged, listingCount: rows.length };
}
