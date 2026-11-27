import {
  ALIMTALK_LMS_FREE_UNITS,
  ALIMTALK_UNIT_PRICE_LMS_KRW,
  ALIMTALK_UNIT_PRICE_SMS_KRW,
} from '../../lib/alimtalkPolicy.js';
import {
  canonicalOrderFormUrl,
  fallbackChannelForBody,
  fillAndAlign,
  mergeMissing,
  variableGapMessage,
} from './alimtalkBarobillMessage.js';
import { normalizeAlimtalkPhone } from './alimtalkPhone.js';

export const ORDER_LINK_SMS_COOLDOWN_MS = 60_000;
export const ORDER_LINK_SMS_COOLDOWN_ERROR = '방금 문자를 보냈습니다. 잠시 뒤 다시 시도해 주세요.';

export type OrderLinkSendStatusName = 'awaiting' | 'delivered' | 'failed' | 'sms_sent';
export type OrderLinkSendChannel = 'ATA' | 'SMS' | 'LMS';

export type OrderLinkSendInfo = {
  status: OrderLinkSendStatusName;
  channel: OrderLinkSendChannel | null;
  at: string;
  message: string | null;
};

export type OrderLinkSmsKind = 'SMS' | 'LMS';

export type OrderLinkSmsMessage = {
  subject: string;
  body: string;
  kind: OrderLinkSmsKind;
};

type SendLogSnapshot = {
  chargeStatus: string;
  deliveredChannel: string | null;
  createdAt: Date;
  finalizedAt: Date | null;
  errorMessage: string | null;
  resultMessage: string | null;
};

export function orderLinkSmsAvailable(phone: string | null | undefined): boolean {
  return normalizeAlimtalkPhone(phone) != null;
}

export function orderLinkSmsPrice(kind: OrderLinkSmsKind): { priceKrw: number; freeUnits: number } {
  return {
    priceKrw: kind === 'SMS' ? ALIMTALK_UNIT_PRICE_SMS_KRW : ALIMTALK_UNIT_PRICE_LMS_KRW,
    freeUnits: ALIMTALK_LMS_FREE_UNITS,
  };
}

export function orderLinkSmsCooldownError(latestSentAt: Date | null, now: Date): string | null {
  if (!latestSentAt) return null;
  if (now.getTime() - latestSentAt.getTime() < ORDER_LINK_SMS_COOLDOWN_MS) return ORDER_LINK_SMS_COOLDOWN_ERROR;
  return null;
}

/** 화면 문구. 「바로빌」은 넣지 않는다. */
export function publicOrderLinkSendMessage(text: string | null | undefined): string | null {
  const cleaned = (text ?? '')
    .replace(/바로빌/g, '발송 서비스')
    .replace(/\d{6,}/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
  return cleaned || null;
}

function channelOf(value: string | null): OrderLinkSendChannel | null {
  if (value === 'ATA' || value === 'SMS' || value === 'LMS') return value;
  return null;
}

function failureText(log: SendLogSnapshot): string | null {
  const error = log.errorMessage?.trim() ?? '';
  if (error) return publicOrderLinkSendMessage(error);
  const result = log.resultMessage?.trim() ?? '';
  if (!result || result.startsWith('sms-bytes:')) return null;
  return publicOrderLinkSendMessage(result);
}

/** 이 발주서의 발주 안내 최신 기록 하나. */
export function judgeOrderLinkSend(log: SendLogSnapshot | null): OrderLinkSendInfo | null {
  if (!log) return null;
  const at = (log.finalizedAt ?? log.createdAt).toISOString();
  const channel = channelOf(log.deliveredChannel);
  if (log.chargeStatus === 'FAILED') {
    return { status: 'failed', channel, at, message: failureText(log) };
  }
  if (log.chargeStatus === 'FREE' || log.chargeStatus === 'PAID') {
    if (channel === 'SMS' || channel === 'LMS') {
      return { status: 'sms_sent', channel, at, message: null };
    }
    return { status: 'delivered', channel: channel ?? 'ATA', at, message: null };
  }
  return { status: 'awaiting', channel, at, message: null };
}

/** 미리보기와 실제 발송이 같은 함수를 쓴다. */
export function renderOrderLinkFallbackSms(
  template: { subject: string; body: string },
  variables: Record<string, string>,
): { ok: true; message: OrderLinkSmsMessage } | { ok: false; error: string } {
  const subjectTemplate = template.subject ?? '';
  const bodyTemplate = template.body ?? '';
  if (!subjectTemplate.trim() || !bodyTemplate.trim()) {
    return { ok: false, error: '대체문자 제목 또는 본문이 없습니다.' };
  }
  const canonical = canonicalOrderFormUrl(variables);
  const subject = fillAndAlign(subjectTemplate, variables, canonical);
  const body = fillAndAlign(bodyTemplate, variables, canonical);
  const missing = mergeMissing([subject.missing, body.missing]);
  if (missing.length > 0) {
    return { ok: false, error: publicOrderLinkSendMessage(variableGapMessage(missing)) ?? '변수 누락' };
  }
  return {
    ok: true,
    message: {
      subject: subject.text,
      body: body.text,
      kind: fallbackChannelForBody(body.text),
    },
  };
}

export async function runOrderLinkSmsDelivery(input: {
  now: Date;
  recentSentAt: Date | null;
  message: OrderLinkSmsMessage;
  send: (message: OrderLinkSmsMessage) => Promise<string>;
  charge: () => Promise<{ chargeStatus: 'FREE' | 'PAID'; chargedKrw: number; freeUnitsConsumed: number }>;
}): Promise<
  | {
      ok: true;
      kind: OrderLinkSmsKind;
      chargeStatus: 'FREE' | 'PAID';
      chargedKrw: number;
      freeUnitsConsumed: number;
      sendKey: string;
    }
  | { ok: false; error: string; charged: false }
> {
  const blocked = orderLinkSmsCooldownError(input.recentSentAt, input.now);
  if (blocked) return { ok: false, error: blocked, charged: false };
  let sendKey = '';
  try {
    sendKey = await input.send(input.message);
  } catch (err) {
    const message = err instanceof Error ? err.message : '문자를 보내지 못했습니다.';
    return { ok: false, error: publicOrderLinkSendMessage(message) ?? '문자를 보내지 못했습니다.', charged: false };
  }
  const charged = await input.charge();
  return {
    ok: true,
    kind: input.message.kind,
    chargeStatus: charged.chargeStatus,
    chargedKrw: charged.chargedKrw,
    freeUnitsConsumed: charged.freeUnitsConsumed,
    sendKey,
  };
}
