import { BarobillCallError } from '../../lib/barobill/soap.js';
import {
  barobillKakaoChannelId,
  describeBarobillKakaoConfigGap,
  sendAT,
  type BarobillAtAccept,
} from '../../lib/barobill/kakaotalk.js';
import { shouldOmitBarobillSmsFallback } from '../../lib/barobill/kakaotalkSmsPermission.js';
import { prisma } from '../../lib/prisma.js';
import type { AlimtalkTemplateCode } from '../../lib/alimtalkPolicy.js';
import { notifyAlimtalkOpsOnceToday, safeOpsSentence } from './alimtalkBarobillOpsMail.js';
import { prepareBarobillMessage } from './alimtalkBarobillMessage.js';
import { chooseAlimtalkSendChannel, isBrandChannelTemplateCode } from './alimtalkBrandChannel.select.js';
import type { TriggerAlimtalkResult } from './alimtalkSend.service.js';

const BALANCE_ERROR_CODES = new Set([-26006, -26011]);
const NO_SMS_FALLBACK_MAIL_KEY = 'barobill-no-sms-fallback';

export async function notifyAlimtalkSmsFallbackPaused(): Promise<void> {
  await notifyAlimtalkOpsOnceToday(
    NO_SMS_FALLBACK_MAIL_KEY,
    '[청소비서] 알림톡 대체문자 없이 발송 중',
    [
      '바로빌 문자 사용 권한이 없어 알림톡만 보내고 있습니다.',
      '실패해도 문자로 다시 보내지 않습니다.',
      '권한이 승인되면 10분 안에 대체문자를 다시 붙여 확인합니다.',
    ].join('\n'),
  );
}

type SendLogPatch = {
  provider: 'barobill';
  chargeStatus: 'AWAITING_RESULT' | 'FAILED';
  barobillSendKey?: string;
  errorMessage?: string;
  resultMessage?: string;
};

/** 발송 시도 1건의 기록만 갱신한다. 성공 키는 하나이고, 여기서 지갑을 차감하지 않는다. */
export async function commitBarobillSendLog(input: {
  pendingId: string;
  smsBytes: number;
  update: (data: SendLogPatch) => Promise<void>;
  send: () => Promise<BarobillAtAccept>;
  notifyOmitted: () => Promise<void>;
  notifyBalance: (message: string) => Promise<void>;
}): Promise<TriggerAlimtalkResult> {
  try {
    const accepted = await input.send();
    await input.update({
      provider: 'barobill',
      barobillSendKey: accepted.sendKey,
      chargeStatus: 'AWAITING_RESULT',
      resultMessage: `sms-bytes:${input.smsBytes}`,
    });
    if (accepted.omittedSmsFallback) {
      try {
        await input.notifyOmitted();
      } catch {
        console.info('[alimtalk] sms-fallback mail failed');
      }
    }
    console.info('[alimtalk] barobill accepted');
    return { ok: true, logId: input.pendingId, chargeStatus: 'AWAITING_RESULT' };
  } catch (err) {
    const failed = failureSentence(err);
    await input.update({
      provider: 'barobill',
      chargeStatus: 'FAILED',
      errorMessage: failed.message,
      resultMessage: failed.message,
    });
    if (failed.code != null && BALANCE_ERROR_CODES.has(failed.code)) {
      await input.notifyBalance(failed.message);
    }
    return { ok: false, error: failed.message };
  }
}

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
  const brandBody = brandChoice.route === 'brand' ? brandChoice.body : null;
  const messageSource =
    template && brandChoice.route === 'brand'
      ? {
          barobillContent: brandBody?.content ?? '',
          barobillTitle: brandBody?.title ?? '',
          barobillButtonsJson: brandBody?.buttons ?? null,
          barobillSmsSubject: template.barobillSmsSubject,
          barobillSmsMessage: template.barobillSmsMessage,
        }
      : template;
  const omitSmsFallback = shouldOmitBarobillSmsFallback();
  const prepared = messageSource
    ? prepareBarobillMessage(messageSource, params.variables, { omitSmsFallback })
    : null;
  const templateName =
    brandChoice.route === 'brand' ? brandChoice.templateName : template?.barobillTemplateName?.trim() ?? '';
  const blocked = !template
    ? '알림톡 서식이 없습니다.'
    : gap
      ? gap.replace(/바로빌/g, '발송 서비스')
      : brandChoice.route === 'brand' && !brandBody?.content?.trim()
        ? '승인된 서식 본문이 없습니다.'
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

  return commitBarobillSendLog({
    pendingId: pending.id,
    smsBytes: prepared.message.smsBytes,
    update: async (data) => {
      await prisma.alimtalkSendLog.updateMany({
        where: { id: pending.id, tenantId: params.billingTenantId },
        data,
      });
    },
    send: () =>
      sendAT({
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
      }),
    notifyOmitted: notifyAlimtalkSmsFallbackPaused,
    notifyBalance: (message) =>
      notifyAlimtalkOpsOnceToday(
        'barobill-balance',
        '[청소비서] 바로빌 잔액 부족',
        `바로빌 알림톡 잔액이 부족합니다.\n${message}`,
      ),
  });
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
): Promise<
  | { route: 'platform' }
  | {
      route: 'brand';
      channelId: string;
      templateName: string;
      body: { content: string; title: string; buttons: unknown };
    }
> {
  if (!operatingCompanyId || !isBrandChannelTemplateCode(templateCode)) {
    return { route: 'platform' };
  }
  const channel = await prisma.alimtalkBrandChannel.findFirst({
    where: { tenantId, operatingCompanyId },
    select: {
      status: true,
      providerChannelId: true,
      templates: {
        where: { templateCode },
        select: { status: true, providerTemplateName: true, content: true, title: true, buttonsJson: true },
        take: 1,
      },
    },
  });
  const row = channel?.templates[0] ?? null;
  const choice = chooseAlimtalkSendChannel({
    channel: channel ? { status: channel.status, providerChannelId: channel.providerChannelId } : null,
    template: row,
    templateCode,
  });
  if (choice.route === 'platform') return { route: 'platform' };
  return {
    route: 'brand',
    channelId: choice.channelId,
    templateName: choice.templateName,
    body: {
      content: row?.content ?? '',
      title: row?.title ?? '',
      buttons: row?.buttonsJson ?? null,
    },
  };
}
