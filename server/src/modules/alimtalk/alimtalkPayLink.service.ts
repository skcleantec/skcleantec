import { prisma } from '../../lib/prisma.js';
import {
  ALIMTALK_MODULE_ID,
  ALIMTALK_TEMPLATE_LABELS,
  alimtalkPlanAllowsFeature,
} from '../../lib/alimtalkPolicy.js';
import { hashLinkToken } from '../card-payment/cardPayment.mask.js';
import { createInquiryChangeLogInTx } from '../inquiry-change-logs/inquiryChangeLogWrite.service.js';
import { isFeatureEnabled } from '../tenants/tenantFeatures.service.js';
import { resolveAlimtalkCustomerContextFromInquiry } from './alimtalkCustomerContext.service.js';
import { maskAlimtalkPhone, normalizeAlimtalkPhone } from './alimtalkPhone.js';
import { executeAlimtalkSend, type TriggerAlimtalkResult } from './alimtalkSend.service.js';
import { buildPayLinkAlimtalkVariables } from './alimtalkTemplateRegistry.js';
import { validateAlimtalkTemplateVariables } from './alimtalkVariableValidation.js';
import {
  isTenantAlimtalkTemplateEnabled,
  resolveSolapiTemplateId,
} from './alimtalkWallet.service.js';

const TEMPLATE_CODE = 'CBISEO_CUST_PAY_LINK' as const;

function extractPayToken(raw: string | null | undefined): string | null {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const fromUrl = s.match(/\/pay\/card\/([^/?#\s]+)/i);
  if (fromUrl?.[1]) return decodeURIComponent(fromUrl[1]);
  if (/^[A-Za-z0-9_-]{8,}$/.test(s)) return s;
  return null;
}

export type PayLinkAlimtalkReady = {
  ready: boolean;
  reason: string | null;
  label: string;
  barobillStatus: number | null;
  barobillStatusLabel: string | null;
};

export async function getPayLinkAlimtalkReady(tenantId: string): Promise<PayLinkAlimtalkReady> {
  const label = ALIMTALK_TEMPLATE_LABELS[TEMPLATE_CODE];
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true, status: true },
  });
  if (!tenant || tenant.status === 'SUSPENDED') {
    return {
      ready: false,
      reason: '업체를 이용할 수 없습니다.',
      label,
      barobillStatus: null,
      barobillStatusLabel: null,
    };
  }
  if (!alimtalkPlanAllowsFeature(tenant.plan)) {
    return {
      ready: false,
      reason: '현재 플랜에서는 알림톡을 사용할 수 없습니다.',
      label,
      barobillStatus: null,
      barobillStatusLabel: null,
    };
  }
  const licensed = await isFeatureEnabled(tenantId, ALIMTALK_MODULE_ID);
  if (!licensed) {
    return {
      ready: false,
      reason: '알림톡 기능이 활성화되지 않았습니다.',
      label,
      barobillStatus: null,
      barobillStatusLabel: null,
    };
  }
  const templateOn = await isTenantAlimtalkTemplateEnabled(tenantId, TEMPLATE_CODE);
  if (!templateOn) {
    return {
      ready: false,
      reason: '업체 설정에서 이 알림톡 서식이 꺼져 있습니다.',
      label,
      barobillStatus: null,
      barobillStatusLabel: null,
    };
  }
  const row = await prisma.alimtalkTemplate.findUnique({
    where: { code: TEMPLATE_CODE },
    select: { solapiTemplateId: true },
  });
  const solapiId = (await resolveSolapiTemplateId(TEMPLATE_CODE)) || row?.solapiTemplateId?.trim();
  if (!solapiId) {
    return {
      ready: false,
      reason: '카카오 승인 대기 중 — 공유·복사로 보내 주세요',
      label,
      barobillStatus: null,
      barobillStatusLabel: '승인 대기',
    };
  }
  return {
    ready: true,
    reason: null,
    label,
    barobillStatus: null,
    barobillStatusLabel: '정상',
  };
}

function buildPreviewText(variables: Record<string, string>): string {
  const payUrl = `https://www.cbiseo.com/pay/card/${variables['#{결제토큰}']}`;
  return [
    `[청소비서] ${variables['#{업체명}']} 결제 안내`,
    '',
    `${variables['#{고객명}']} 님, 청소비 결제를 안내드립니다.`,
    '',
    `결제 내용: ${variables['#{결제내용}']}`,
    `결제 금액: ${variables['#{결제금액}']}`,
    '',
    '지금 결제해 주세요.',
    payUrl,
    '',
    `문의: ${variables['#{문의전화}']}`,
  ].join('\n');
}

async function buildPayLinkContext(input: {
  tenantId: string;
  paymentId: string;
  payTokenOrUrl: string;
  toPhone?: string | null;
}) {
  const payToken = extractPayToken(input.payTokenOrUrl);
  if (!payToken) return { error: '결제 링크 토큰이 올바르지 않습니다.' } as const;

  const payment = await prisma.cardPayment.findFirst({
    where: { id: input.paymentId, tenantId: input.tenantId },
    select: {
      id: true,
      inquiryId: true,
      customerName: true,
      goodsName: true,
      amountWon: true,
      linkTokenHash: true,
      method: true,
    },
  });
  if (!payment) return { error: '결제 건을 찾을 수 없습니다.' } as const;
  if (payment.method !== 'CUSTOMER_LINK') return { error: '고객 링크 결제 건이 아닙니다.' } as const;
  if (!payment.linkTokenHash) return { error: '결제 링크가 아직 없습니다.' } as const;
  if (hashLinkToken(payToken) !== payment.linkTokenHash) {
    return { error: '결제 링크가 이 건과 일치하지 않습니다.' } as const;
  }
  if (!payment.inquiryId) return { error: '접수에 연결된 결제만 알림톡을 보낼 수 있습니다.' } as const;

  const ctx = await resolveAlimtalkCustomerContextFromInquiry(payment.inquiryId);
  if ('error' in ctx) return { error: ctx.error } as const;

  const toPhone = normalizeAlimtalkPhone(input.toPhone ?? ctx.inquiry.customerPhone);
  if (!toPhone) return { error: '고객 연락처가 없거나 형식이 올바르지 않습니다.' } as const;

  const variables = await buildPayLinkAlimtalkVariables({
    tenant: ctx.customerFacingTenant,
    customerName: payment.customerName || ctx.inquiry.customerName || '고객',
    goodsName: payment.goodsName?.trim() || '청소 서비스',
    amountWon: payment.amountWon,
    payToken,
    brandOperatingCompany: ctx.brandOperatingCompany,
    brandOperatingCompanyId: ctx.customerFacingOperatingCompanyId,
  });
  const variableError = validateAlimtalkTemplateVariables(TEMPLATE_CODE, variables);
  if (variableError) return { error: variableError } as const;

  return {
    payment,
    toPhone,
    variables,
    customerFacingTenantId: ctx.customerFacingTenant.id,
    customerFacingOperatingCompanyId: ctx.customerFacingOperatingCompanyId,
    billingTenant: ctx.billingTenant,
    billingTenantId: ctx.billingTenantId,
    inquiryId: ctx.sourceInquiryId,
    customerName: payment.customerName || ctx.inquiry.customerName || '고객',
  };
}

export async function previewPayLinkAlimtalk(input: {
  tenantId: string;
  paymentId: string;
  payTokenOrUrl: string;
  toPhone?: string | null;
}) {
  const ready = await getPayLinkAlimtalkReady(input.tenantId);
  const built = await buildPayLinkContext(input);
  if ('error' in built) return { ok: false as const, error: built.error };
  return {
    ok: true as const,
    toPhone: built.toPhone,
    maskedPhone: maskAlimtalkPhone(built.toPhone),
    previewText: buildPreviewText(built.variables),
    variables: built.variables,
    ready,
  };
}

export async function triggerAlimtalkPayLink(input: {
  tenantId: string;
  paymentId: string;
  payTokenOrUrl: string;
  toPhone?: string | null;
  actorUserId?: string | null;
}): Promise<
  TriggerAlimtalkResult & { maskedPhone?: string; previewText?: string; sentAtIso?: string }
> {
  const ready = await getPayLinkAlimtalkReady(input.tenantId);
  if (!ready.ready) {
    return { ok: false, error: ready.reason ?? '알림톡을 보낼 수 없습니다.' };
  }

  const built = await buildPayLinkContext(input);
  if ('error' in built) return { ok: false, error: built.error || '결제 링크 알림톡을 준비하지 못했습니다.' };

  const result = await executeAlimtalkSend({
    billingTenantId: built.billingTenantId,
    tenant: built.billingTenant,
    templateCode: TEMPLATE_CODE,
    toPhone: built.toPhone,
    variables: built.variables,
    inquiryId: built.inquiryId,
    customerFacingTenantId: built.customerFacingTenantId,
    customerFacingOperatingCompanyId: built.customerFacingOperatingCompanyId,
  });
  if (!result.ok) return result;

  try {
    await prisma.$transaction(async (tx) => {
      await createInquiryChangeLogInTx(tx, {
        inquiryId: built.inquiryId,
        customerName: built.customerName,
        actorId: input.actorUserId ?? null,
        lines: [`결제 링크 알림톡 발송 (${maskAlimtalkPhone(built.toPhone)})`],
      });
    });
  } catch {
    /* 이력 실패해도 발송 성공 유지 */
  }

  return {
    ...result,
    maskedPhone: maskAlimtalkPhone(built.toPhone),
    previewText: buildPreviewText(built.variables),
    sentAtIso: new Date().toISOString(),
  };
}
