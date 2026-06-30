/**
 * Phase 3 — C/S (A10)
 */
import type { PrismaClient } from '@prisma/client';
import { addDaysToKstYmd, kstTodayYmd } from '../src/modules/inquiries/inquiryListDateRange.js';
import { DEFAULT_TENANT_ID } from '../src/modules/tenants/tenant.constants.js';
import { GUIDE_DEMO_TAG, guideDemoCsId } from './guide-demo/constants.js';
import { purgeGuideDemoCsSeed } from './guide-demo/purge.js';

type CsScenario = {
  id: string;
  code: string;
  customerName: string;
  customerPhone: string;
  content: string;
  status: string;
  serviceRating?: number;
  createdDayOffset: number;
};

function kstNoon(dayOffset: number): Date {
  const ymd = addDaysToKstYmd(kstTodayYmd(), dayOffset);
  return new Date(`${ymd}T12:00:00+09:00`);
}

export async function runGuideDemoCsSeed(prisma: PrismaClient): Promise<{ purged: number; count: number }> {
  const purged = await purgeGuideDemoCsSeed(prisma);

  const scenarios: CsScenario[] = [
    {
      id: guideDemoCsId(1),
      code: 'A10-01',
      customerName: 'CS접수',
      customerPhone: '010-8200-1001',
      content: '청소 후 창틀 먼지가 남았습니다.',
      status: 'RECEIVED',
      createdDayOffset: 0,
    },
    {
      id: guideDemoCsId(2),
      code: 'A10-02',
      customerName: 'CS처리중',
      customerPhone: '010-8200-1002',
      content: '재방문 일정 조율 중입니다.',
      status: 'CS_PROCESSING',
      createdDayOffset: -1,
    },
    {
      id: guideDemoCsId(3),
      code: 'A10-03',
      customerName: 'CS완료',
      customerPhone: '010-8200-1003',
      content: '전화 안내 후 만족 확인.',
      status: 'DONE',
      serviceRating: 5,
      createdDayOffset: -3,
    },
    {
      id: guideDemoCsId(4),
      code: 'A10-04',
      customerName: 'CS별점3',
      customerPhone: '010-8200-1004',
      content: '부분 재청소 요청.',
      status: 'DONE',
      serviceRating: 3,
      createdDayOffset: -5,
    },
    {
      id: guideDemoCsId(5),
      code: 'A10-05',
      customerName: 'CS신규',
      customerPhone: '010-8200-1005',
      content: '예약금 환불 문의.',
      status: 'RECEIVED',
      createdDayOffset: -2,
    },
    {
      id: guideDemoCsId(6),
      code: 'A10-06',
      customerName: 'CS긴급',
      customerPhone: '010-8200-1006',
      content: '당일 재방문 요청.',
      status: 'CS_PROCESSING',
      createdDayOffset: 0,
    },
  ];

  const admin = await prisma.user.findFirst({
    where: { tenantId: DEFAULT_TENANT_ID, role: 'ADMIN', isActive: true },
    orderBy: { createdAt: 'asc' },
  });

  for (const s of scenarios) {
    const createdAt = kstNoon(s.createdDayOffset);
    await prisma.csReport.create({
      data: {
        id: s.id,
        tenantId: DEFAULT_TENANT_ID,
        customerName: s.customerName,
        customerPhone: s.customerPhone,
        content: s.content,
        status: s.status,
        serviceRating: s.serviceRating ?? null,
        imageUrls: [],
        memo: `${GUIDE_DEMO_TAG} ${s.code}`,
        createdAt,
        completedAt: s.status === 'DONE' ? createdAt : null,
        completedById: s.status === 'DONE' ? admin?.id ?? null : null,
      },
    });
  }

  return { purged, count: scenarios.length };
}
