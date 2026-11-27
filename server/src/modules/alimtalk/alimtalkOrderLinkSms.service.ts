import { BarobillCallError } from '../../lib/barobill/soap.js';
import { sendBarobillTextMessage } from '../../lib/barobill/sms.js';
import { ALIMTALK_MODULE_ID, alimtalkPlanAllowsFeature } from '../../lib/alimtalkPolicy.js';
import { prisma } from '../../lib/prisma.js';
import { isFeatureEnabled } from '../tenants/tenantFeatures.service.js';
import { resolveAlimtalkCustomerContextFromOrderForm } from './alimtalkCustomerContext.service.js';
import { normalizeAlimtalkPhone } from './alimtalkPhone.js';
import { buildAlimtalkVariables } from './alimtalkTemplateRegistry.js';
import { assertAlimtalkRecipientAllowed } from './alimtalkStagingPhoneGuard.js';
import { applyAlimtalkCharge, isTenantAlimtalkTemplateEnabled, preflightAlimtalkSend } from './alimtalkWallet.service.js';
import {
  judgeOrderLinkSend,
  orderLinkSmsCooldownError,
  orderLinkSmsPrice,
  publicOrderLinkSendMessage,
  renderOrderLinkFallbackSms,
  runOrderLinkSmsDelivery,
  ORDER_LINK_SMS_COOLDOWN_ERROR,
  ORDER_LINK_SMS_COOLDOWN_MS,
  type OrderLinkSendInfo,
  type OrderLinkSmsMessage,
} from './alimtalkOrderLinkSms.js';

const TEMPLATE_CODE = 'CBISEO_CUST_ORDER_LINK' as const;

type Prepared =
  | { ok: false; error: string }
  | {
      ok: true;
      phone: string;
      toName: string;
      message: OrderLinkSmsMessage;
      billingTenantId: string;
      plan: string;
      customerFacingTenantId: string;
      customerFacingOperatingCompanyId: string | null;
    };

async function prepareOrderLinkSms(
  tenantId: string,
  orderFormId: string,
  toPhone: string | null | undefined,
): Promise<Prepared> {
  const ctx = await resolveAlimtalkCustomerContextFromOrderForm(orderFormId, tenantId);
  if ('error' in ctx) return { ok: false, error: ctx.error };
  if (ctx.billingTenant.status === 'SUSPENDED') return { ok: false, error: '이용이 중지된 업체입니다.' };
  if (!alimtalkPlanAllowsFeature(ctx.billingTenant.plan)) {
    return { ok: false, error: '현재 플랜에서는 알림톡을 사용할 수 없습니다. (Standard 이상)' };
  }
  const licensed = await isFeatureEnabled(ctx.billingTenant.id, ALIMTALK_MODULE_ID);
  if (!licensed) return { ok: false, error: '알림톡 기능이 활성화되지 않았습니다. 플랫폼에 문의해 주세요.' };
  const templateOn = await isTenantAlimtalkTemplateEnabled(ctx.billingTenant.id, TEMPLATE_CODE);
  if (!templateOn) return { ok: false, error: '이 알림톡 서식이 꺼져 있어 발송할 수 없습니다.' };

  const phone = normalizeAlimtalkPhone(toPhone ?? ctx.order.customerPhone);
  if (!phone) return { ok: false, error: '고객 연락처가 없거나 형식이 올바르지 않습니다.' };
  const stagingBlock = assertAlimtalkRecipientAllowed(phone);
  if (stagingBlock) return { ok: false, error: stagingBlock };

  const variables = await buildAlimtalkVariables(TEMPLATE_CODE, {
    order: ctx.order,
    tenant: ctx.customerFacingTenant,
    brandOperatingCompany: ctx.brandOperatingCompany,
    brandOperatingCompanyId: ctx.customerFacingOperatingCompanyId,
  });
  if (variables['#{발주토큰}'] !== ctx.order.token) {
    return { ok: false, error: '발주 링크 토큰이 올바르지 않습니다.' };
  }

  const template = await prisma.alimtalkTemplate.findFirst({
    where: { code: TEMPLATE_CODE },
    select: { barobillSmsSubject: true, barobillSmsMessage: true },
  });
  const rendered = renderOrderLinkFallbackSms(
    {
      subject: template?.barobillSmsSubject ?? '',
      body: template?.barobillSmsMessage ?? '',
    },
    variables,
  );
  if (!rendered.ok) return rendered;

  return {
    ok: true,
    phone,
    toName: (ctx.order.customerName ?? '').trim().slice(0, 20),
    message: rendered.message,
    billingTenantId: ctx.billingTenantId,
    plan: ctx.billingTenant.plan,
    customerFacingTenantId: ctx.customerFacingTenant.id,
    customerFacingOperatingCompanyId: ctx.customerFacingOperatingCompanyId,
  };
}

export async function previewOrderLinkSms(tenantId: string, orderFormId: string) {
  const prepared = await prepareOrderLinkSms(tenantId, orderFormId, null);
  if (!prepared.ok) return prepared;
  const price = orderLinkSmsPrice(prepared.message.kind);
  return {
    ok: true as const,
    toPhone: prepared.phone,
    kind: prepared.message.kind,
    priceKrw: price.priceKrw,
    freeUnits: price.freeUnits,
    subject: prepared.message.subject,
    body: prepared.message.body,
  };
}

async function recentSmsSentAt(tenantId: string, orderFormId: string, now: Date): Promise<Date | null> {
  const row = await prisma.alimtalkSendLog.findFirst({
    where: {
      tenantId,
      orderFormId,
      templateCode: TEMPLATE_CODE,
      deliveredChannel: { in: ['SMS', 'LMS'] },
      chargeStatus: { in: ['FREE', 'PAID', 'PENDING'] },
      createdAt: { gte: new Date(now.getTime() - ORDER_LINK_SMS_COOLDOWN_MS) },
    },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  });
  return row?.createdAt ?? null;
}

export async function sendOrderLinkSms(tenantId: string, orderFormId: string, toPhone: string | null | undefined) {
  const prepared = await prepareOrderLinkSms(tenantId, orderFormId, toPhone);
  if (!prepared.ok) return prepared;
  const now = new Date();
  const recentSentAt = await recentSmsSentAt(prepared.billingTenantId, orderFormId, now);
  const cooled = orderLinkSmsCooldownError(recentSentAt, now);
  if (cooled) return { ok: false as const, error: cooled };

  const preflight = await preflightAlimtalkSend(prepared.billingTenantId, prepared.plan, prepared.message.kind);
  if (!preflight.ok) return { ok: false as const, error: preflight.error };

  const pending = await prisma.alimtalkSendLog.create({
    data: {
      tenantId: prepared.billingTenantId,
      templateCode: TEMPLATE_CODE,
      orderFormId,
      toPhone: prepared.phone,
      provider: 'barobill',
      chargeStatus: 'PENDING',
      deliveredChannel: prepared.message.kind,
      customerFacingTenantId: prepared.customerFacingTenantId,
      customerFacingOperatingCompanyId: prepared.customerFacingOperatingCompanyId,
    },
  });

  const peers = await prisma.alimtalkSendLog.findMany({
    where: {
      tenantId: prepared.billingTenantId,
      orderFormId,
      templateCode: TEMPLATE_CODE,
      deliveredChannel: { in: ['SMS', 'LMS'] },
      chargeStatus: { in: ['FREE', 'PAID', 'PENDING'] },
      createdAt: { gte: new Date(now.getTime() - ORDER_LINK_SMS_COOLDOWN_MS) },
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (peers.length > 1 && peers[0]?.id !== pending.id) {
    await prisma.alimtalkSendLog.deleteMany({
      where: { id: pending.id, tenantId: prepared.billingTenantId, chargeStatus: 'PENDING' },
    });
    return { ok: false as const, error: ORDER_LINK_SMS_COOLDOWN_ERROR };
  }

  const outcome = await runOrderLinkSmsDelivery({
    now,
    recentSentAt: null,
    message: prepared.message,
    send: async (message) => {
      try {
        return await sendBarobillTextMessage({
          kind: message.kind,
          toPhone: prepared.phone,
          toName: prepared.toName,
          subject: message.subject,
          body: message.body,
        });
      } catch (err) {
        if (err instanceof BarobillCallError) {
          throw new Error(publicOrderLinkSendMessage(err.detail) || publicOrderLinkSendMessage(err.message) || '문자를 보내지 못했습니다.');
        }
        throw err;
      }
    },
    charge: async () => {
      const charged = await applyAlimtalkCharge({
        tenantId: prepared.billingTenantId,
        plan: prepared.plan,
        channel: prepared.message.kind,
        refId: pending.id,
      });
      return {
        chargeStatus: charged.chargeStatus,
        chargedKrw: charged.tenantUnitPriceKrw,
        freeUnitsConsumed: charged.freeUnitsConsumed,
      };
    },
  });

  if (!outcome.ok) {
    await prisma.alimtalkSendLog.updateMany({
      where: { id: pending.id, tenantId: prepared.billingTenantId, chargeStatus: 'PENDING' },
      data: {
        chargeStatus: 'FAILED',
        errorMessage: outcome.error,
        resultMessage: outcome.error,
        finalizedAt: new Date(),
      },
    });
    return { ok: false as const, error: outcome.error };
  }

  await prisma.alimtalkSendLog.updateMany({
    where: { id: pending.id, tenantId: prepared.billingTenantId },
    data: {
      chargeStatus: outcome.chargeStatus,
      deliveredChannel: outcome.kind,
      barobillSendKey: outcome.sendKey,
      freeUnitsConsumed: outcome.freeUnitsConsumed,
      tenantUnitPriceKrw: outcome.chargedKrw,
      finalizedAt: new Date(),
    },
  });
  return {
    ok: true as const,
    kind: outcome.kind,
    chargeStatus: outcome.chargeStatus,
    chargedKrw: outcome.chargedKrw,
  };
}

export async function loadOrderLinkSendMap(
  tenantId: string,
  orderFormIds: string[],
): Promise<Map<string, OrderLinkSendInfo>> {
  const ids = [...new Set(orderFormIds.filter(Boolean))];
  const out = new Map<string, OrderLinkSendInfo>();
  if (ids.length === 0) return out;
  const logs = await prisma.alimtalkSendLog.findMany({
    where: { tenantId, templateCode: TEMPLATE_CODE, orderFormId: { in: ids } },
    orderBy: { createdAt: 'desc' },
    select: {
      orderFormId: true,
      chargeStatus: true,
      deliveredChannel: true,
      createdAt: true,
      finalizedAt: true,
      errorMessage: true,
      resultMessage: true,
    },
  });
  for (const log of logs) {
    if (!log.orderFormId || out.has(log.orderFormId)) continue;
    const info = judgeOrderLinkSend(log);
    if (info) out.set(log.orderFormId, info);
  }
  return out;
}

export async function loadOrderLinkSend(tenantId: string, orderFormId: string): Promise<OrderLinkSendInfo | null> {
  const map = await loadOrderLinkSendMap(tenantId, [orderFormId]);
  return map.get(orderFormId) ?? null;
}
