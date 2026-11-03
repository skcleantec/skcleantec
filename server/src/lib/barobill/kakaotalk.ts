import { SERVICE_BRIDGE_CORP_NUM } from './env.js';
import { callBarobill } from './soap.js';

const MAX_BATCH = 100;

export type BarobillKakaoButton = {
  ButtonType: string;
  Name: string;
  Url1: string;
  Url2: string;
};

/** SendATKakaotalkEx 의 KakaotalkATMessageEx. 필드명은 바로빌 레퍼런스 그대로. */
export type BarobillAtMessage = {
  ReceiverNum: string;
  ReceiverName: string;
  Title: string;
  Message: string;
  SmsSubject: string;
  SmsMessage: string;
  Buttons: BarobillKakaoButton[];
};

export type BarobillKakaoChannel = {
  ChannelId: string;
  ChannelName: string;
  Status: number;
};

export type BarobillKakaoTemplate = {
  ChannelId: string;
  TemplateName: string;
  TemplateMessageType: number;
  TemplateEmphasizeType: number;
  TemplateContent: string;
  TemplateExtra: string;
  TemplateTitle: string;
  TemplateSubtitle: string;
  Status: number;
  SecurityFlag: boolean;
  Buttons: BarobillKakaoButton[];
};

export type BarobillKakaoSendResult = {
  SendKey: string;
  SendStatus: number;
  ResultCode: number;
  ResultMessage: string;
  SmsSendState: string;
};

export type BarobillSmsReply = 'E' | 'A' | 'N';

const KAKAO_ENV_NAMES = [
  'BAROBILL_KAKAO_SENDER_ID',
  'BAROBILL_KAKAO_CHANNEL_ID',
  'BAROBILL_KAKAO_SMS_FROM',
] as const;

export function missingBarobillKakaoEnv(): string[] {
  const missing: string[] = [];
  if (!process.env.BAROBILL_CERTKEY?.trim()) missing.push('BAROBILL_CERTKEY');
  for (const name of KAKAO_ENV_NAMES) {
    if (!process.env[name]?.trim()) missing.push(name);
  }
  return missing;
}

/** 값이 아니라 빠진 환경변수 이름만 안내한다. */
export function describeBarobillKakaoConfigGap(): string | null {
  const missing = missingBarobillKakaoEnv();
  if (missing.length === 0) return null;
  return `바로빌 알림톡 설정이 없습니다: ${missing.join(', ')}`;
}

function readEnv(name: (typeof KAKAO_ENV_NAMES)[number]): string {
  const value = process.env[name]?.trim() ?? '';
  if (!value) throw new Error(`${name} 가 없습니다.`);
  return value;
}

function asText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function asInt(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function rowsOf(value: unknown, key: string): Record<string, unknown>[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.filter((row) => row && typeof row === 'object') as Record<string, unknown>[];
  if (typeof value !== 'object') return [];
  const inner = (value as Record<string, unknown>)[key];
  if (inner == null) {
    if (key in (value as Record<string, unknown>) === false && Object.keys(value as object).length > 0) {
      return [value as Record<string, unknown>];
    }
    return [];
  }
  if (Array.isArray(inner)) return inner.filter((row) => row && typeof row === 'object') as Record<string, unknown>[];
  if (typeof inner === 'object') return [inner as Record<string, unknown>];
  return [];
}

function readButtons(value: unknown): BarobillKakaoButton[] {
  return rowsOf(value, 'KakaotalkButton').map((row) => ({
    ButtonType: asText(row.ButtonType),
    Name: asText(row.Name),
    Url1: asText(row.Url1),
    Url2: asText(row.Url2),
  }));
}

function toSoapMessage(message: BarobillAtMessage): Record<string, unknown> {
  const buttons = message.Buttons.filter((button) => button.Name.trim() || button.Url1.trim());
  return {
    ReceiverNum: message.ReceiverNum,
    ReceiverName: message.ReceiverName,
    Title: message.Title,
    Message: message.Message,
    SmsSubject: message.SmsSubject,
    SmsMessage: message.SmsMessage,
    ...(buttons.length > 0 ? { Buttons: { KakaotalkButton: buttons } } : {}),
  };
}

function assertBatchSize(count: number): void {
  if (count < 1 || count > MAX_BATCH) {
    throw new Error(`바로빌 알림톡은 한 번에 1~${MAX_BATCH}건만 보낼 수 있습니다.`);
  }
}

export async function getChannels(): Promise<BarobillKakaoChannel[]> {
  const value = await callBarobill('KAKAOTALK', 'GetKakaotalkChannels', {
    CorpNum: SERVICE_BRIDGE_CORP_NUM,
  });
  return rowsOf(value, 'KakaotalkChannel').map((row) => ({
    ChannelId: asText(row.ChannelId),
    ChannelName: asText(row.ChannelName),
    Status: asInt(row.Status),
  }));
}

export async function getTemplates(channelId: string): Promise<BarobillKakaoTemplate[]> {
  const channel = channelId.trim();
  if (!channel) throw new Error('BAROBILL_KAKAO_CHANNEL_ID 가 없습니다.');
  const value = await callBarobill('KAKAOTALK', 'GetKakaotalkTemplates', {
    CorpNum: SERVICE_BRIDGE_CORP_NUM,
    ChannelId: channel,
  });
  const parsed = rowsOf(value, 'KakaotalkTemplate').map((row) => ({
    ChannelId: asText(row.ChannelId),
    TemplateName: asText(row.TemplateName),
    TemplateMessageType: asInt(row.TemplateMessageType),
    TemplateEmphasizeType: asInt(row.TemplateEmphasizeType),
    TemplateContent: asText(row.TemplateContent),
    TemplateExtra: asText(row.TemplateExtra),
    TemplateTitle: asText(row.TemplateTitle),
    TemplateSubtitle: asText(row.TemplateSubtitle),
    Status: asInt(row.Status),
    SecurityFlag: row.SecurityFlag === true || row.SecurityFlag === 'true',
    Buttons: readButtons(row.Buttons),
  }));
  const failed = parsed.find((row) => row.Status < 0 && !row.TemplateName.trim());
  if (failed) {
    let detail = '';
    try {
      const text = await callBarobill('KAKAOTALK', 'GetErrString', { ErrCode: failed.Status });
      detail = asText(text).replace(/\s+/g, ' ').trim();
    } catch {
      detail = '';
    }
    throw new Error(detail || `바로빌 오류 ${failed.Status}`);
  }
  return parsed;
}

async function managementUrl(method: string, id: string): Promise<string> {
  const userId = id.trim();
  if (!userId) throw new Error('BAROBILL_KAKAO_SENDER_ID 가 없습니다.');
  const value = await callBarobill('KAKAOTALK', method, {
    CorpNum: SERVICE_BRIDGE_CORP_NUM,
    ID: userId,
  });
  const url = asText(value).trim();
  if (!url) throw new Error('바로빌 관리 주소가 비어 있습니다.');
  return url;
}

export function getChannelManagementUrl(id: string): Promise<string> {
  return managementUrl('GetKakaotalkChannelManagementURL', id);
}

export function getTemplateManagementUrl(id: string): Promise<string> {
  return managementUrl('GetKakaotalkTemplateManagementURL', id);
}

export function getHistoryUrl(id: string): Promise<string> {
  return managementUrl('GetKakaotalkHistoryURL', id);
}

export async function sendAT(input: {
  templateName: string;
  sendDt?: string;
  smsReply?: BarobillSmsReply;
  message: BarobillAtMessage;
}): Promise<string> {
  const value = await callBarobill(
    'KAKAOTALK',
    'SendATKakaotalkEx',
    {
      CorpNum: SERVICE_BRIDGE_CORP_NUM,
      SenderID: readEnv('BAROBILL_KAKAO_SENDER_ID'),
      YellowId: readEnv('BAROBILL_KAKAO_CHANNEL_ID'),
      TemplateName: input.templateName,
      SendDT: input.sendDt ?? '',
      SmsReply: input.smsReply ?? 'E',
      SmsSenderNum: readEnv('BAROBILL_KAKAO_SMS_FROM'),
      KakaotalkMessage: toSoapMessage(input.message),
    },
    { redact: [input.message.ReceiverNum] },
  );
  const sendKey = asText(value).trim();
  if (!sendKey) throw new Error('바로빌 발송키가 비어 있습니다.');
  return sendKey;
}

export async function sendATMany(input: {
  templateName: string;
  sendDt?: string;
  smsReply?: BarobillSmsReply;
  messages: BarobillAtMessage[];
}): Promise<string> {
  assertBatchSize(input.messages.length);
  const value = await callBarobill(
    'KAKAOTALK',
    'SendATKakaotalksEx',
    {
      CorpNum: SERVICE_BRIDGE_CORP_NUM,
      SenderID: readEnv('BAROBILL_KAKAO_SENDER_ID'),
      YellowId: readEnv('BAROBILL_KAKAO_CHANNEL_ID'),
      TemplateName: input.templateName,
      SendDT: input.sendDt ?? '',
      SmsReply: input.smsReply ?? 'E',
      SmsSenderNum: readEnv('BAROBILL_KAKAO_SMS_FROM'),
      KakaotalkMessages: {
        KakaotalkATMessageEx: input.messages.map(toSoapMessage),
      },
    },
    { redact: input.messages.map((message) => message.ReceiverNum) },
  );
  const sendKey = asText(value).trim();
  if (!sendKey) throw new Error('바로빌 발송키가 비어 있습니다.');
  return sendKey;
}

function readSendResult(row: Record<string, unknown>): BarobillKakaoSendResult {
  return {
    SendKey: asText(row.SendKey),
    SendStatus: asInt(row.SendStatus),
    ResultCode: asInt(row.ResultCode),
    ResultMessage: asText(row.ResultMessage),
    SmsSendState: asText(row.SmsSendState),
  };
}

export async function getSendResults(sendKeys: string[]): Promise<BarobillKakaoSendResult[]> {
  const keys = sendKeys.map((key) => key.trim()).filter(Boolean);
  const out: BarobillKakaoSendResult[] = [];
  for (let i = 0; i < keys.length; i += MAX_BATCH) {
    const chunk = keys.slice(i, i + MAX_BATCH);
    const value = await callBarobill('KAKAOTALK', 'GetSendKakaotalksEx', {
      CorpNum: SERVICE_BRIDGE_CORP_NUM,
      SendKeyList: { string: chunk },
    });
    out.push(...rowsOf(value, 'KakaotalkEx').map(readSendResult));
  }
  return out;
}

export async function cancelReserved(sendKey: string): Promise<number> {
  const key = sendKey.trim();
  if (!key) throw new Error('바로빌 발송키가 없습니다.');
  const value = await callBarobill('KAKAOTALK', 'CancelReservedKakaotalk', {
    CorpNum: SERVICE_BRIDGE_CORP_NUM,
    SendKey: key,
  });
  return asInt(value);
}

export async function getPartnerBalance(): Promise<number> {
  const value = await callBarobill('KAKAOTALK', 'GetBalanceCostAmountEx', {
    CorpNum: SERVICE_BRIDGE_CORP_NUM,
  });
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) throw new Error('바로빌 잔액 형식이 올바르지 않습니다.');
  return n;
}

export function barobillKakaoSenderId(): string {
  return readEnv('BAROBILL_KAKAO_SENDER_ID');
}

export function barobillKakaoChannelId(): string {
  return readEnv('BAROBILL_KAKAO_CHANNEL_ID');
}
