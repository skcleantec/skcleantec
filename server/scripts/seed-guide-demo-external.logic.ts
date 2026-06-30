/**
 * Phase 3 — 타업체 정산 (A12)
 */
import bcrypt from 'bcryptjs';
import type { PrismaClient } from '@prisma/client';
import { allocateNextInquiryNumber } from '../src/modules/inquiries/inquiryNumber.js';
import { addDaysToKstYmd, kstTodayYmd } from '../src/modules/inquiries/inquiryListDateRange.js';
import { getDefaultOperatingCompanyId } from '../src/modules/operating-companies/operatingCompany.service.js';
import { DEFAULT_TENANT_ID } from '../src/modules/tenants/tenant.constants.js';
import {
  GUIDE_DEMO_EXTERNAL_COMPANY_ID,
  GUIDE_DEMO_TAG,
  guideDemoInquiryId,
} from './guide-demo/constants.js';
import { purgeGuideDemoExternalSeed } from './guide-demo/purge.js';

const EXTERNAL_TAG = `${GUIDE_DEMO_TAG} 타업체`;
const PARTNER_EMAIL = 'guide-external@demo';
const PARTNER_PASSWORD = '1234';

function kstNoon(dayOffset: number): Date {
  const ymd = addDaysToKstYmd(kstTodayYmd(), dayOffset);
  return new Date(`${ymd}T12:00:00+09:00`);
}

export async function runGuideDemoExternalSeed(
  prisma: PrismaClient,
): Promise<{ purged: number; inquiryCount: number; partnerEmail: string }> {
  const purged = await purgeGuideDemoExternalSeed(prisma);

  const admin = await prisma.user.findFirst({
    where: { tenantId: DEFAULT_TENANT_ID, role: 'ADMIN', isActive: true },
    orderBy: { createdAt: 'asc' },
  });
  if (!admin) throw new Error('ADMIN 계정이 없습니다.');

  const operatingCompanyId = await getDefaultOperatingCompanyId(prisma, DEFAULT_TENANT_ID);
  const hash = await bcrypt.hash(PARTNER_PASSWORD, 10);

  await prisma.externalCompany.create({
    data: {
      id: GUIDE_DEMO_EXTERNAL_COMPANY_ID,
      tenantId: DEFAULT_TENANT_ID,
      name: '가이드데모 협력청소',
      phone: '010-8300-0001',
      memo: `${GUIDE_DEMO_TAG} 타업체 데모`,
      isActive: true,
    },
  });

  const partner = await prisma.user.create({
    data: {
      tenantId: DEFAULT_TENANT_ID,
      email: PARTNER_EMAIL,
      passwordHash: hash,
      name: '가이드협력',
      role: 'EXTERNAL_PARTNER',
      externalCompanyId: GUIDE_DEMO_EXTERNAL_COMPANY_ID,
      isActive: true,
    },
  });

  await prisma.externalCompanySettlementPayment.create({
    data: {
      externalCompanyId: GUIDE_DEMO_EXTERNAL_COMPANY_ID,
      operatingCompanyId,
      amount: 120_000,
      memo: `${GUIDE_DEMO_TAG} 샘플 지급`,
      actorId: admin.id,
    },
  });

  const scenarios = [
    { id: guideDemoInquiryId(80), code: 'X-01', name: '타업체진행', fee: 90_000, dayOffset: 2 },
    { id: guideDemoInquiryId(81), code: 'X-02', name: '타업체완료', fee: 110_000, dayOffset: -1, status: 'COMPLETED' as const },
  ];

  for (const s of scenarios) {
    const preferredDate = kstNoon(s.dayOffset);
    const inquiryNumber = await allocateNextInquiryNumber(prisma, DEFAULT_TENANT_ID);
    await prisma.inquiry.create({
      data: {
        id: s.id,
        tenantId: DEFAULT_TENANT_ID,
        operatingCompanyId,
        inquiryNumber,
        customerName: s.name,
        customerPhone: '010-8300-2001',
        address: '서울 마포구 월드컵북로 396',
        areaPyeong: 30,
        propertyType: '아파트',
        roomCount: 3,
        bathroomCount: 2,
        kitchenCount: 1,
        preferredDate,
        preferredTime: '오전',
        status: s.status ?? 'RECEIVED',
        source: '전화',
        createdById: admin.id,
        serviceTotalAmount: 520_000,
        serviceDepositAmount: 200_000,
        serviceBalanceAmount: 320_000,
        externalTransferFee: s.fee,
        memo: `${EXTERNAL_TAG} ${s.code}`,
      },
    });
    await prisma.assignment.create({
      data: {
        tenantId: DEFAULT_TENANT_ID,
        inquiryId: s.id,
        teamLeaderId: partner.id,
        assignedById: admin.id,
        sortOrder: 0,
      },
    });
  }

  return { purged, inquiryCount: scenarios.length, partnerEmail: PARTNER_EMAIL };
}
