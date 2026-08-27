import crypto from 'crypto';
import {
  ALIMTALK_TEMPLATE_CODES,
  type AlimtalkTemplateCode,
} from '../../lib/alimtalkPolicy.js';

export type SolapiSendMessageInput = {
  to: string;
  from: string;
  pfId: string;
  templateId: string;
  variables: Record<string, string>;
};

export type SolapiSendResult = {
  ok: boolean;
  messageId?: string;
  statusCode?: string;
  errorMessage?: string;
  channelType?: string;
};

function solapiAuthHeader(apiKey: string, apiSecret: string): string {
  const date = new Date().toISOString();
  const salt = crypto.randomBytes(16).toString('hex');
  const signature = crypto.createHmac('sha256', apiSecret).update(date + salt).digest('hex');
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

export function readSolapiConfig(): {
  apiKey: string;
  apiSecret: string;
  pfId: string;
  from: string;
} | null {
  const apiKey = process.env.SOLAPI_API_KEY?.trim();
  const apiSecret = process.env.SOLAPI_API_SECRET?.trim();
  const pfId = process.env.SOLAPI_KAKAO_PFID?.trim();
  const from = process.env.SOLAPI_FROM_NUMBER?.trim();
  if (!apiKey || !apiSecret || !pfId || !from) return null;
  return { apiKey, apiSecret, pfId, from };
}

/** Railway·로컬 `server/.env`에 넣을 SOLAPI_* 누락 항목 안내 */
export function describeSolapiConfigGap(): string | null {
  const missing: string[] = [];
  if (!process.env.SOLAPI_API_KEY?.trim()) missing.push('SOLAPI_API_KEY');
  if (!process.env.SOLAPI_API_SECRET?.trim()) missing.push('SOLAPI_API_SECRET');
  if (!process.env.SOLAPI_KAKAO_PFID?.trim()) missing.push('SOLAPI_KAKAO_PFID');
  if (!process.env.SOLAPI_FROM_NUMBER?.trim()) missing.push('SOLAPI_FROM_NUMBER');
  if (missing.length === 0) return null;
  return `솔라피 발송 설정이 완료되지 않았습니다. 서버 환경변수를 확인해 주세요: ${missing.join(', ')}`;
}

const ENV_TEMPLATE_MAP: Record<AlimtalkTemplateCode, string> = {
  CBISEO_CUST_ORDER_LINK: 'SOLAPI_ALIMTALK_TEMPLATE_ORDER_LINK',
  CBISEO_CUST_ORDER_DONE: 'SOLAPI_ALIMTALK_TEMPLATE_ORDER_DONE',
  CBISEO_CUST_SCHEDULE_D2: 'SOLAPI_ALIMTALK_TEMPLATE_SCHEDULE_D2',
};

/** 카카오 검수 승인 templateId — env 미설정 시 폴백 */
export const DEFAULT_SOLAPI_TEMPLATE_IDS: Record<AlimtalkTemplateCode, string> = {
  CBISEO_CUST_ORDER_LINK: 'KA01TP260821085834166DanPJHVm7HA',
  CBISEO_CUST_ORDER_DONE: 'KA01TP2608210907017889JVtrqGLFhq',
  CBISEO_CUST_SCHEDULE_D2: 'KA01TP260821092336472avWT4PJf0Dn',
};

export function solapiTemplateIdFromEnv(code: AlimtalkTemplateCode): string | null {
  const key = ENV_TEMPLATE_MAP[code];
  const v = process.env[key]?.trim();
  return v || DEFAULT_SOLAPI_TEMPLATE_IDS[code] || null;
}

export async function sendSolapiAlimtalk(input: SolapiSendMessageInput): Promise<SolapiSendResult> {
  const cfg = readSolapiConfig();
  if (!cfg) {
    return { ok: false, errorMessage: '솔라피 환경변수(SOLAPI_API_KEY 등)가 설정되지 않았습니다.' };
  }

  const body = {
    messages: [
      {
        to: input.to,
        from: input.from,
        kakaoOptions: {
          pfId: input.pfId,
          templateId: input.templateId,
          variables: input.variables,
          disableSms: false,
        },
      },
    ],
  };

  try {
    const res = await fetch('https://api.solapi.com/messages/v4/send-many', {
      method: 'POST',
      headers: {
        Authorization: solapiAuthHeader(cfg.apiKey, cfg.apiSecret),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json()) as {
      errorCode?: string;
      errorMessage?: string;
      failedMessageList?: { statusMessage?: string; statusCode?: string }[];
      groupInfo?: { count?: { total?: number } };
      messageList?: { messageId?: string; statusCode?: string; statusMessage?: string; type?: string }[];
    };

    if (!res.ok) {
      return {
        ok: false,
        errorMessage: json.errorMessage || json.failedMessageList?.[0]?.statusMessage || `HTTP ${res.status}`,
      };
    }

    const first = json.messageList?.[0];
    const statusCode = first?.statusCode ?? json.failedMessageList?.[0]?.statusCode;
    const ok = statusCode === '2000' || statusCode === '3000' || statusCode === '4000';
    return {
      ok,
      messageId: first?.messageId,
      statusCode,
      channelType: first?.type,
      errorMessage: ok ? undefined : first?.statusMessage || json.errorMessage || '발송 실패',
    };
  } catch (e) {
    return { ok: false, errorMessage: e instanceof Error ? e.message : '솔라피 API 호출 실패' };
  }
}

export const ALIMTALK_TEMPLATE_SEED: {
  code: AlimtalkTemplateCode;
  name: string;
  triggerType: 'manual' | 'auto';
}[] = ALIMTALK_TEMPLATE_CODES.map((code) => ({
  code,
  name:
    code === 'CBISEO_CUST_ORDER_LINK'
      ? '[고객] 발주서 작성·예약 안내'
      : code === 'CBISEO_CUST_ORDER_DONE'
        ? '[고객] 예약(발주서) 접수 완료'
        : '[고객] 예약 일정 확인(청소 2일 전)',
  triggerType: code === 'CBISEO_CUST_ORDER_LINK' ? 'manual' : 'auto',
}));
