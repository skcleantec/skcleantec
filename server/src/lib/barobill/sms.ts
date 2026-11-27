import { SERVICE_BRIDGE_CORP_NUM } from './env.js';
import { callBarobill } from './soap.js';

function readKakaoEnv(name: 'BAROBILL_KAKAO_SENDER_ID' | 'BAROBILL_KAKAO_SMS_FROM'): string {
  const value = process.env[name]?.trim() ?? '';
  if (!value) throw new Error('문자 발송 설정이 없습니다.');
  return value;
}

function asText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

export type BarobillSmsKind = 'SMS' | 'LMS';

/** 단문은 SendSMSMessage, 장문은 SendLMSMessage. 접수번호 문자열을 돌려준다. */
export async function sendBarobillTextMessage(input: {
  kind: BarobillSmsKind;
  toPhone: string;
  toName: string;
  subject: string;
  body: string;
}): Promise<string> {
  const shared = {
    CorpNum: SERVICE_BRIDGE_CORP_NUM,
    SenderID: readKakaoEnv('BAROBILL_KAKAO_SENDER_ID'),
    FromNumber: readKakaoEnv('BAROBILL_KAKAO_SMS_FROM'),
    ToName: input.toName.trim().slice(0, 20),
    ToNumber: input.toPhone,
    Contents: input.body,
    SendDT: '',
    RefKey: '',
  };
  const value = await callBarobill(
    'SMS',
    input.kind === 'LMS' ? 'SendLMSMessage' : 'SendSMSMessage',
    input.kind === 'LMS' ? { ...shared, Subject: input.subject } : shared,
    { redact: [input.toPhone] },
  );
  const receipt = asText(value).trim();
  if (!receipt) throw new Error('문자 접수번호가 비어 있습니다.');
  return receipt;
}
