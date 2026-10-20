import { prisma } from '../../lib/prisma.js';
import { getTenantConfig } from '../tenants/tenantConfig.service.js';
import { resolveTenantCustomerFacingBrandName } from '../tenants/tenantConfig.schema.js';

const PLATFORM_BRAND_NAME = '청소비서';

/** 발주서 업종 팩 → 고객 문구의 비용 이름. 청소 업종은 「청소」. */
const SERVICE_WORD_BY_PACK: Record<string, string> = {
  move_in: '청소',
  office: '청소',
  aircon: '에어컨',
  appliance: '가전',
  grout: '줄눈',
  moving: '이사',
  pest: '방역',
};

function toWon(n: number | null | undefined): number {
  const v = Math.round(Number(n) || 0);
  return v > 0 ? v : 0;
}

function serviceWordFromPack(packId: string | null | undefined): string {
  const key = packId?.trim() ?? '';
  return SERVICE_WORD_BY_PACK[key] ?? '청소';
}

function usableCompanyName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed || trimmed === PLATFORM_BRAND_NAME || trimmed === '업체') return '';
  return trimmed;
}

/**
 * 인증결재 링크 문자에 넣을 비용 내역과 업체이름.
 * 정보공유·연계로 받은 접수(수신 미러)에는 업체이름을 넣지 않는다.
 */
export async function loadCardPaymentCustomerCopy(tenantId: string, inquiryId: string) {
  const inquiry = await prisma.inquiry.findFirst({
    where: { tenantId, id: inquiryId, deletedAt: null },
    select: {
      id: true,
      serviceTotalAmount: true,
      serviceDepositAmount: true,
      serviceBalanceAmount: true,
      operatingCompany: { select: { name: true } },
      orderForm: { select: { template: { select: { industryPackId: true } } } },
    },
  });
  if (!inquiry) return null;

  const [tenant, config, extra, receivedShare, fallbackTemplate] = await Promise.all([
    prisma.tenant.findFirst({ where: { id: tenantId }, select: { name: true } }),
    getTenantConfig(tenantId),
    prisma.extraWorkRecord.aggregate({
      where: { tenantId, inquiryId: inquiry.id },
      _sum: { amountWon: true },
    }),
    prisma.tenantInquiryShare.findFirst({
      where: { targetTenantId: tenantId, targetInquiryId: inquiry.id },
      select: { id: true },
    }),
    inquiry.orderForm?.template?.industryPackId
      ? Promise.resolve(null)
      : prisma.orderFormTemplate.findFirst({
          where: { tenantId, isDefault: true },
          select: { industryPackId: true },
        }),
  ]);

  const brand = usableCompanyName(
    inquiry.operatingCompany?.name?.trim() ||
      resolveTenantCustomerFacingBrandName(config, tenant?.name ?? ''),
  );
  const packId = inquiry.orderForm?.template?.industryPackId ?? fallbackTemplate?.industryPackId;

  return {
    serviceWord: serviceWordFromPack(packId),
    cleaningWon: toWon(inquiry.serviceTotalAmount),
    depositWon: toWon(inquiry.serviceDepositAmount),
    balanceWon: toWon(inquiry.serviceBalanceAmount),
    extraWorkWon: toWon(extra._sum.amountWon),
    includeCompanyName: !receivedShare && Boolean(brand),
    companyName: receivedShare ? '' : brand,
  };
}
