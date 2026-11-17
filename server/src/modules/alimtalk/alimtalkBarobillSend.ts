import { BarobillCallError } from '../../lib/barobill/soap.js';
import { barobillKakaoChannelId, describeBarobillKakaoConfigGap, sendAT } from '../../lib/barobill/kakaotalk.js';
import { prisma } from '../../lib/prisma.js';
import type { AlimtalkTemplateCode } from '../../lib/alimtalkPolicy.js';
import { notifyAlimtalkOpsOnceToday, safeOpsSentence } from './alimtalkBarobillOpsMail.js';
import { prepareBarobillMessage } from './alimtalkBarobillMessage.js';
import { chooseAlimtalkSendChannel } from './alimtalkBrandChannel.select.js';
import type { TriggerAlimtalkResult } from './alimtalkSend.service.js';

const BALANCE_ERROR_CODES = new Set([-26006, -26011]);

function failureSentence(err: unknown): { message: string; code: number | null } {
  if (err instanceof BarobillCallError) {
    const message = safeOpsSentence(err.detail) || '발송 서비스에서 보내지 못했습니다.';
    return { message: message.replace(/바로빌/g, '발송 서비스'), code: err.code };
  }
  if (err instanceof Error) {
    return {
      message: (safeOpsSentence(err.message) || '발송 서비스에서 보내지 못했습니다.').replace(/바로빌/g, '발송 서비스'),
      code: null,
    };
  }
  return { message: '발송 서비스에서 보내지 못했습니다.', code: null };
}

export async function sendAlimtalkViaBarobill(params: {
  billingTenantId: string;
  templateCode: AlimtalkTemplateCode;
  toPhone: string;
  variables: Record<string, string>;
  orderFormId?: string | null;
  inquiryId?: string | null;
  customerFacingTenantId: string;
  customerFacingOperatingCompanyId: string | null;
}): Promise<TriggerAlimtalkResult> {
  const template = await prisma.alimtalkTemplate.findFirst({
    where: { code: params.templateCode },
    select: {
      barobillTemplateName: true,
      barobillContent: true,
      barobillTitle: true,
      barobillButtonsJson: true,
      barobillSmsSubject: true,
      barobillSmsMessage: true,
      barobillStatus: true,
    },
  });

  const baseLog = {
    tenantId: params.billingTenantId,
    templateCode: params.templateCode,
    orderFormId: params.orderFormId ?? null,
    inquiryId: params.inquiryId ?? null,
    toPhone: params.toPhone,
    provider: 'barobill',
    customerFacingTenantId: params.customerFacingTenantId,
    customerFacingOperatingCompanyId: params.customerFacingOperatingCompanyId,
  };

  const brandChoice = await resolveBrandSendChoice(
    params.billingTenantId,
    params.customerFacingOperatingCompanyId,
    params.templateCode,
  );
  const gap = describeBarobillKakaoConfigGap();
  const prepared = template ? prepareBarobillMessage(template, params.variables) : null;
  const templateName =
    brandChoice.route === 'brand' ? brandChoice.templateName : template?.barobillTemplateName?.trim() ?? '';
  const blocked = !template
    ? '알림톡 서식이 없습니다.'
    : gap
      ? gap.replace(/바로빌/g, '발송 서비스')
      : brandChoice.route === 'platform' && template.barobillStatus !== 3
        ? '알림톡 서식 심사가 끝나지 않았습니다.'
        : !templateName
          ? '알림톡 서식 이름이 없습니다.'
          : prepared && !prepared.ok
            ? prepared.error.replace(/바로빌/g, '발송 서비스')
            : null;

  const sentChannelId =
    brandChoice.route === 'brand' ? brandChoice.channelId : safePlatformChannelId();
  if (blocked || !prepared || !prepared.ok || !templateName) {
    const error = blocked ?? '알림톡 발송을 준비하지 못했습니다.';
    await prisma.alimtalkSendLog.create({
      data: { ...baseLog, chargeStatus: 'FAILED', errorMessage: error, sentChannelId },
    });
    return { ok: false, error };
  }

  const pending = await prisma.alimtalkSendLog.create({
    data: { ...baseLog, chargeStatus: 'PENDING', sentChannelId },
  });

  try {
    const sendKey = await sendAT({
      templateName,
      yellowId: brandChoice.route === 'brand' ? brandChoice.channelId : undefined,
      smsReply: 'A',
      message: {
        ReceiverNum: params.toPhone,
        ReceiverName: (params.variables['#{고객명}'] ?? '').trim().slice(0, 20),
        Title: prepared.message.title,
        Message: prepared.message.message,
        SmsSubject: prepared.message.smsSubject,
        SmsMessage: prepared.message.smsMessage,
        Buttons: prepared.message.buttons,
      },
    });
    await prisma.alimtalkSendLog.update({
      where: { id: pending.id },
      data: {
        provider: 'barobill',
        barobillSendKey: sendKey,
        chargeStatus: 'AWAITING_RESULT',
        resultMessage: `sms-bytes:${prepared.message.smsBytes}`,
      },
    });
    console.info('[alimtalk] barobill accepted');
    return { ok: true, logId: pending.id, chargeStatus: 'AWAITING_RESULT' };
  } catch (err) {
    const failed = failureSentence(err);
    await prisma.alimtalkSendLog.update({
      where: { id: pending.id },
      data: {
        provider: 'barobill',
        chargeStatus: 'FAILED',
        errorMessage: failed.message,
        resultMessage: failed.message,
      },
    });
    if (failed.code != null && BALANCE_ERROR_CODES.has(failed.code)) {
      await notifyAlimtalkOpsOnceToday(
        'barobill-balance',
        '[청소비서] 바로빌 잔액 부족',
        `바로빌 알림톡 잔액이 부족합니다.\n${failed.message}`,
      );
    }
    return { ok: false, error: failed.message };
  }
}

function safePlatformChannelId(): string | null {
  try {
    return barobillKakaoChannelId();
  } catch {
    return null;
  }
}

async function resolveBrandSendChoice(
  tenantId: string,
  operatingCompanyId: string | null,
  templateCode: AlimtalkTemplateCode,
) {
  if (!operatingCompanyId) return chooseAlimtalkSendChannel({ channel: null, template: null });
  const channel = await prisma.alimtalkBrandChannel.findFirst({
    where: { tenantId, operatingCompanyId },
    select: {
      status: true,
      providerChannelId: true,
      templates: {
        where: { templateCode },
        select: { status: true, providerTemplateName: true },
        take: 1,
      },
    },
  });
  return chooseAlimtalkSendChannel({
    channel: channel ? { status: channel.status, providerChannelId: channel.providerChannelId } : null,
    template: channel?.templates[0] ?? null,
  });
}
