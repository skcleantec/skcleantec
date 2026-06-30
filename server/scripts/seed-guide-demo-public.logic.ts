/**
 * Phase 5 — 공개 고객 URL (발주서)
 */
import type { PrismaClient } from '@prisma/client';
import { ORDER_FORM_PENDING_PLACEHOLDER_ADDRESS } from '../src/lib/orderFormPendingAddress.js';
import { allocateNextInquiryNumber } from '../src/modules/inquiries/inquiryNumber.js';
import { addDaysToKstYmd, kstTodayYmd } from '../src/modules/inquiries/inquiryListDateRange.js';
import { getDefaultOperatingCompanyId } from '../src/modules/operating-companies/operatingCompany.service.js';
import { DEFAULT_TENANT_ID } from '../src/modules/tenants/tenant.constants.js';
import {
  GUIDE_DEMO_MARKETER_EMAIL,
  GUIDE_DEMO_ORDER_TOKEN_PREFIX,
  GUIDE_DEMO_TAG,
  guideDemoInquiryId,
  guideDemoPublicOrderToken,
} from './guide-demo/constants.js';

function kstNoon(dayOffset: number): Date {
  const ymd = addDaysToKstYmd(kstTodayYmd(), dayOffset);
  return new Date(`${ymd}T12:00:00+09:00`);
}

/** 공개 발주서 토큰 purge는 admin purge(orderForm prefix)에 포함 */
export async function runGuideDemoPublicSeed(
  prisma: PrismaClient,
): Promise<{ tokens: string[] }> {
  const marketer =
    (await prisma.user.findFirst({
      where: { tenantId: DEFAULT_TENANT_ID, email: GUIDE_DEMO_MARKETER_EMAIL, isActive: true },
    })) ??
    (await prisma.user.findFirst({
      where: { tenantId: DEFAULT_TENANT_ID, role: 'MARKETER', isActive: true },
    }));
  if (!marketer) throw new Error('마케터 계정이 없습니다.');

  const operatingCompanyId = await getDefaultOperatingCompanyId(prisma, DEFAULT_TENANT_ID);
  const tokens = [guideDemoPublicOrderToken(1), guideDemoPublicOrderToken(2)];

  const rows = [
    {
      token: tokens[0]!,
      id: guideDemoInquiryId(90),
      code: 'D1',
      name: '공개작성중',
      submitted: false,
      total: 580_000,
    },
    {
      token: tokens[1]!,
      id: guideDemoInquiryId(91),
      code: 'D2',
      name: '공개제출완료',
      submitted: true,
      total: 640_000,
    },
  ] as const;

  for (const row of rows) {
    const createdAt = kstNoon(-1);
    const preferredYmd = addDaysToKstYmd(kstTodayYmd(), 7);
    await prisma.$transaction(async (tx) => {
      const existingForm = await tx.orderForm.findUnique({ where: { token: row.token } });
      if (existingForm) {
        await tx.inquiry.deleteMany({ where: { orderFormId: existingForm.id } });
        await tx.orderForm.delete({ where: { id: existingForm.id } });
      }

      const form = await tx.orderForm.create({
        data: {
          tenantId: DEFAULT_TENANT_ID,
          operatingCompanyId,
          token: row.token,
          customerName: row.name,
          customerPhone: '010-8400-1001',
          totalAmount: row.total,
          depositAmount: 20_000,
          balanceAmount: row.total - 20_000,
          preferredDate: preferredYmd,
          preferredTime: '오전',
          areaPyeong: 32,
          createdById: marketer.id,
          createdAt,
          submittedAt: row.submitted ? createdAt : null,
        },
      });

      const inquiryNumber = await allocateNextInquiryNumber(tx, DEFAULT_TENANT_ID);
      await tx.inquiry.create({
        data: {
          id: row.id,
          tenantId: DEFAULT_TENANT_ID,
          operatingCompanyId,
          inquiryNumber,
          orderFormId: form.id,
          customerName: row.name,
          customerPhone: '010-8400-1001',
          address: row.submitted ? '서울 강남구 테헤란로 152' : ORDER_FORM_PENDING_PLACEHOLDER_ADDRESS,
          areaPyeong: 32,
          propertyType: '아파트',
          preferredDate: kstNoon(7),
          preferredTime: '오전',
          status: row.submitted ? 'RECEIVED' : 'ORDER_FORM_PENDING',
          source: '발주서',
          createdById: marketer.id,
          createdAt,
          serviceTotalAmount: row.total,
          serviceDepositAmount: 20_000,
          serviceBalanceAmount: row.total - 20_000,
          memo: `${GUIDE_DEMO_TAG} 공개 ${row.code}`,
        },
      });
    });
  }

  return { tokens };
}

/** 문서용 공개 URL 목록 */
export function guideDemoPublicUrls(baseUrl = 'https://cbiseo.com'): { label: string; url: string }[] {
  return [
    {
      label: '발주서 작성 중',
      url: `${baseUrl}/order/${guideDemoPublicOrderToken(1)}?tenant=sk`,
    },
    {
      label: '발주서 제출 완료',
      url: `${baseUrl}/order/${guideDemoPublicOrderToken(2)}?tenant=sk`,
    },
  ];
}

export { GUIDE_DEMO_ORDER_TOKEN_PREFIX };
