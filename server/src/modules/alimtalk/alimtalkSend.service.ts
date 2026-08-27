import type { InquiryStatus, Tenant } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import {
  ALIMTALK_MODULE_ID,
  ALIMTALK_TEMPLATE_CODES,
  ALIMTALK_TEMPLATE_LABELS,
  alimtalkPlanAllowsFeature,
  type AlimtalkTemplateCode,
} from '../../lib/alimtalkPolicy.js';
import { isFeatureEnabled } from '../tenants/tenantFeatures.service.js';
import { describeSolapiConfigGap, readSolapiConfig, sendSolapiAlimtalk } from './alimtalkSolapi.client.js';
import {
  resolveAlimtalkCustomerContextFromInquiry,
  resolveAlimtalkCustomerContextFromOrderForm,
} from './alimtalkCustomerContext.service.js';
import { normalizeAlimtalkPhone } from './alimtalkPhone.js';
import { buildAlimtalkVariables } from './alimtalkTemplateRegistry.js';
import { validateAlimtalkTemplateVariables } from './alimtalkVariableValidation.js';
import {
  applyAlimtalkCharge,
  isTenantAlimtalkTemplateEnabled,
  preflightAlimtalkSend,
  resolveSolapiTemplateId,
} from './alimtalkWallet.service.js';

export type TriggerAlimtalkResult =
  | { ok: true; logId: string; messageId?: string; chargeStatus: string }
  | { ok: false; error: string };

type TenantGateRow = Pick<Tenant, 'id' | 'slug' | 'plan' | 'status'>;

async function assertAlimtalkLicensed(
  tenant: TenantGateRow,
  templateCode: AlimtalkTemplateCode,
): Promise<TriggerAlimtalkResult | { ok: true }> {
  if (tenant.status === 'SUSPENDED') return { ok: false, error: '이용이 중지된 업체입니다.' };
  if (!alimtalkPlanAllowsFeature(tenant.plan)) {
    return { ok: false, error: '현재 플랜에서는 알림톡을 사용할 수 없습니다. (Standard 이상)' };
  }
  const licensed = await isFeatureEnabled(tenant.id, ALIMTALK_MODULE_ID);
  if (!licensed) {
    return { ok: false, error: '알림톡 기능이 활성화되지 않았습니다. 플랫폼에 문의해 주세요.' };
  }
  const templateOn = await isTenantAlimtalkTemplateEnabled(tenant.id, templateCode);
  if (!templateOn) {
    return { ok: false, error: '이 알림톡 서식이 꺼져 있어 발송할 수 없습니다.' };
  }
  return { ok: true };
}

async function executeAlimtalkSend(params: {
  billingTenantId: string;
  tenant: TenantGateRow;
  templateCode: AlimtalkTemplateCode;
  toPhone: string;
  variables: Record<string, string>;
  orderFormId?: string | null;
  inquiryId?: string | null;
  customerFacingTenantId: string;
  customerFacingOperatingCompanyId: string | null;
}): Promise<TriggerAlimtalkResult> {
  const preflight = await preflightAlimtalkSend(params.billingTenantId, params.tenant.plan, 'ATA');
  if (!preflight.ok) return { ok: false, error: preflight.error };

  const templateId = await resolveSolapiTemplateId(params.templateCode);
  if (!templateId) {
    return { ok: false, error: '솔라피 템플릿 ID가 설정되지 않았습니다.' };
  }

  const cfg = readSolapiConfig();
  if (!cfg) {
    return { ok: false, error: describeSolapiConfigGap() ?? '솔라피 발송 설정이 완료되지 않았습니다.' };
  }

  const pendingLog = await prisma.alimtalkSendLog.create({
    data: {
      tenantId: params.billingTenantId,
      templateCode: params.templateCode,
      orderFormId: params.orderFormId ?? null,
      inquiryId: params.inquiryId ?? null,
      toPhone: params.toPhone,
      chargeStatus: 'PENDING',
      customerFacingTenantId: params.customerFacingTenantId,
      customerFacingOperatingCompanyId: params.customerFacingOperatingCompanyId,
    },
  });

  const sent = await sendSolapiAlimtalk({
    to: params.toPhone,
    from: cfg.from,
    pfId: cfg.pfId,
    templateId,
    variables: params.variables,
  });

  if (!sent.ok) {
    await prisma.alimtalkSendLog.update({
      where: { id: pendingLog.id },
      data: {
        chargeStatus: 'FAILED',
        errorMessage: sent.errorMessage ?? '발송 실패',
      },
    });
    return { ok: false, error: sent.errorMessage ?? '알림톡 발송에 실패했습니다.' };
  }

  const channel = sent.channelType === 'LMS' ? 'LMS' : 'ATA';
  const charge = await applyAlimtalkCharge({
    tenantId: params.billingTenantId,
    plan: params.tenant.plan,
    channel,
  });

  await prisma.alimtalkSendLog.update({
    where: { id: pendingLog.id },
    data: {
      solapiMessageId: sent.messageId ?? null,
      chargeStatus: charge.chargeStatus,
      deliveredChannel: channel,
      freeUnitsConsumed: charge.freeUnitsConsumed,
      tenantUnitPriceKrw: charge.tenantUnitPriceKrw,
    },
  });

  return {
    ok: true,
    logId: pendingLog.id,
    messageId: sent.messageId,
    chargeStatus: charge.chargeStatus,
  };
}

export type TriggerAlimtalkOrderLinkInput = {
  tenantId: string;
  orderFormId: string;
  toPhone?: string | null;
  actorUserId?: string;
};

export async function triggerAlimtalkOrderLink(
  input: TriggerAlimtalkOrderLinkInput,
): Promise<TriggerAlimtalkResult> {
  const ctx = await resolveAlimtalkCustomerContextFromOrderForm(input.orderFormId, input.tenantId);
  if ('error' in ctx) return { ok: false, error: ctx.error };

  const templateCode: AlimtalkTemplateCode = 'CBISEO_CUST_ORDER_LINK';
  const gate = await assertAlimtalkLicensed(ctx.billingTenant, templateCode);
  if (!gate.ok) return gate;

  const phone = normalizeAlimtalkPhone(input.toPhone ?? ctx.order.customerPhone);
  if (!phone) {
    return { ok: false, error: '고객 연락처가 없거나 형식이 올바르지 않습니다.' };
  }

  const variables = await buildAlimtalkVariables(templateCode, {
    order: ctx.order,
    tenant: ctx.customerFacingTenant,
    brandOperatingCompany: ctx.brandOperatingCompany,
    brandOperatingCompanyId: ctx.customerFacingOperatingCompanyId,
  });

  const variableError = validateAlimtalkTemplateVariables(templateCode, variables);
  if (variableError) return { ok: false, error: variableError };

  return executeAlimtalkSend({
    billingTenantId: ctx.billingTenantId,
    tenant: ctx.billingTenant,
    templateCode,
    toPhone: phone,
    variables,
    orderFormId: ctx.order.id,
    customerFacingTenantId: ctx.customerFacingTenant.id,
    customerFacingOperatingCompanyId: ctx.customerFacingOperatingCompanyId,
  });
}

export type TriggerAlimtalkOrderDoneInput = {
  tenantId: string;
  orderFormId: string;
  inquiryId: string;
  toPhone?: string | null;
};

export async function triggerAlimtalkOrderDone(
  input: TriggerAlimtalkOrderDoneInput,
): Promise<TriggerAlimtalkResult> {
  const ctx = await resolveAlimtalkCustomerContextFromInquiry(input.inquiryId);
  if ('error' in ctx) return { ok: false, error: ctx.error };

  const templateCode: AlimtalkTemplateCode = 'CBISEO_CUST_ORDER_DONE';
  const gate = await assertAlimtalkLicensed(ctx.billingTenant, templateCode);
  if (!gate.ok) return gate;

  if (ctx.order.id !== input.orderFormId) {
    return { ok: false, error: '발주서와 접수가 일치하지 않습니다.' };
  }

  const phone = normalizeAlimtalkPhone(
    input.toPhone ?? ctx.inquiry.customerPhone ?? ctx.order.customerPhone,
  );
  if (!phone) {
    return { ok: false, error: '고객 연락처가 없거나 형식이 올바르지 않습니다.' };
  }

  const variables = await buildAlimtalkVariables(templateCode, {
    order: ctx.order,
    tenant: ctx.customerFacingTenant,
    inquiry: ctx.inquiry,
    brandOperatingCompany: ctx.brandOperatingCompany,
    brandOperatingCompanyId: ctx.customerFacingOperatingCompanyId,
  });

  const variableError = validateAlimtalkTemplateVariables(templateCode, variables);
  if (variableError) return { ok: false, error: variableError };

  return executeAlimtalkSend({
    billingTenantId: ctx.billingTenantId,
    tenant: ctx.billingTenant,
    templateCode,
    toPhone: phone,
    variables,
    orderFormId: ctx.order.id,
    inquiryId: ctx.sourceInquiryId,
    customerFacingTenantId: ctx.customerFacingTenant.id,
    customerFacingOperatingCompanyId: ctx.customerFacingOperatingCompanyId,
  });
}

export type TriggerAlimtalkScheduleD2Input = {
  inquiryId: string;
  /** @deprecated resolver가 §3.1 기준 billing tenant를 결정합니다 */
  tenantId?: string;
};

export async function triggerAlimtalkScheduleD2(
  input: TriggerAlimtalkScheduleD2Input,
): Promise<TriggerAlimtalkResult> {
  const ctx = await resolveAlimtalkCustomerContextFromInquiry(input.inquiryId);
  if ('error' in ctx) return { ok: false, error: ctx.error };

  const templateCode: AlimtalkTemplateCode = 'CBISEO_CUST_SCHEDULE_D2';
  const gate = await assertAlimtalkLicensed(ctx.billingTenant, templateCode);
  if (!gate.ok) return gate;

  const existing = await prisma.alimtalkSendLog.findFirst({
    where: {
      tenantId: ctx.billingTenantId,
      inquiryId: ctx.sourceInquiryId,
      templateCode,
      chargeStatus: { in: ['FREE', 'PAID', 'PENDING'] },
    },
    select: { id: true },
  });
  if (existing) {
    return { ok: false, error: '이미 발송된 건입니다.' };
  }

  const phone = normalizeAlimtalkPhone(ctx.inquiry.customerPhone ?? ctx.order.customerPhone);
  if (!phone) {
    return { ok: false, error: '고객 연락처가 없거나 형식이 올바르지 않습니다.' };
  }

  const variables = await buildAlimtalkVariables(templateCode, {
    order: ctx.order,
    tenant: ctx.customerFacingTenant,
    inquiry: ctx.inquiry,
    brandOperatingCompany: ctx.brandOperatingCompany,
    brandOperatingCompanyId: ctx.customerFacingOperatingCompanyId,
  });

  const variableError = validateAlimtalkTemplateVariables(templateCode, variables);
  if (variableError) return { ok: false, error: variableError };

  return executeAlimtalkSend({
    billingTenantId: ctx.billingTenantId,
    tenant: ctx.billingTenant,
    templateCode,
    toPhone: phone,
    variables,
    orderFormId: ctx.order.id,
    inquiryId: ctx.sourceInquiryId,
    customerFacingTenantId: ctx.customerFacingTenant.id,
    customerFacingOperatingCompanyId: ctx.customerFacingOperatingCompanyId,
  });
}

export async function getTenantAlimtalkStatus(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { plan: true },
  });
  if (!tenant) return null;
  const licensed = await isFeatureEnabled(tenantId, ALIMTALK_MODULE_ID);
  const { getAlimtalkWalletView } = await import('./alimtalkWallet.service.js');
  const wallet = licensed && alimtalkPlanAllowsFeature(tenant.plan)
    ? await getAlimtalkWalletView(tenantId, tenant.plan)
    : null;
  const settings = await prisma.tenantAlimtalkTemplateSetting.findMany({
    where: { tenantId },
  });
  const settingMap = new Map(settings.map((s) => [s.templateCode, s.isEnabled]));
  return {
    licensed,
    planAllows: alimtalkPlanAllowsFeature(tenant.plan),
    wallet,
    templates: ALIMTALK_TEMPLATE_CODES.map((code) => ({
      code,
      label: ALIMTALK_TEMPLATE_LABELS[code],
      enabled: settingMap.get(code) !== false,
    })),
  };
}

export const ALIMTALK_SCHEDULE_D2_ELIGIBLE_STATUSES: InquiryStatus[] = [
  'RECEIVED',
  'ASSIGNED',
  'IN_PROGRESS',
  'CS_PROCESSING',
];
