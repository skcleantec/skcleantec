/** 바로빌 결과 미확정 메일·차감 판정. DB·바로빌 호출 없음. */

const SMS_SUCCESS = new Set(['1', '성공', '전송성공', '완료', 's', 'success', 'y']);
const SMS_FAILED = new Set(['', '2', '실패', '전송실패', 'f', 'fail', 'n', '-']);
const SMS_PENDING = new Set(['0', '3', '대기', '전송중', '발송중', '예약']);

const PHONE_SRC = '01[016789][-.\\s]?\\d{3,4}[-.\\s]?\\d{4}';

export type BarobillChargeDecision = 'ata' | 'fallback' | 'fail' | 'wait';

export type UnconfirmedStatusCopy = {
  line: string;
  defaultReason: string;
};

export type UnconfirmedMailItem = {
  tenantName: string;
  templateName: string;
  customerName: string;
  maskedPhone: string;
  inquiryNumber: string | null;
  sentAt: Date;
  statusLine: string;
  reason: string;
};

export function fallbackOutcome(state: string): 'success' | 'failed' | 'pending' | 'unknown' {
  const key = state.trim().toLowerCase();
  if (SMS_SUCCESS.has(key)) return 'success';
  if (SMS_PENDING.has(key)) return 'pending';
  if (SMS_FAILED.has(key)) return 'failed';
  return 'unknown';
}

/** SendStatus 1 은 알림톡 성공(차감). 2 이고 대체문자 '-'·빈 값이면 실패(차감 없음). */
export function barobillChargeDecision(sendStatus: number, smsState: string): BarobillChargeDecision {
  if (sendStatus === 1) return 'ata';
  if (sendStatus !== 2) return 'wait';
  const outcome = fallbackOutcome(smsState);
  if (outcome === 'failed') return 'fail';
  if (outcome === 'success') return 'fallback';
  return 'wait';
}

export function describeUnconfirmedStatus(input: {
  found: boolean;
  sendStatus: number | null;
  smsSendState: string | null;
}): UnconfirmedStatusCopy {
  if (!input.found) {
    return {
      line: '바로빌에서 결과를 찾지 못함',
      defaultReason: '바로빌 조회에서 이 발송을 찾지 못했습니다.',
    };
  }
  const sms = input.smsSendState ?? '';
  if (input.sendStatus === 1) {
    return {
      line: '알림톡은 전달됐습니다',
      defaultReason: '차감 확인이 아직 끝나지 않았습니다.',
    };
  }
  if (input.sendStatus === 2) {
    const outcome = fallbackOutcome(sms);
    if (outcome === 'pending') {
      return {
        line: '알림톡 실패 → 대체문자 보내는 중',
        defaultReason: '대체문자 결과를 기다리는 중입니다.',
      };
    }
    if (outcome === 'failed') {
      return {
        line: '알림톡 실패 → 대체문자 안 보냄',
        defaultReason: '대체문자를 보내지 않았습니다.',
      };
    }
    return {
      line: '알림톡 실패 → 대체문자 결과를 확인하는 중',
      defaultReason: '대체문자 결과가 아직 정해지지 않았습니다.',
    };
  }
  if (input.sendStatus === 3) {
    return {
      line: '바로빌에서 예약 발송을 기다리는 중',
      defaultReason: '예약된 발송 시각이 아직 지나지 않았습니다.',
    };
  }
  return {
    line: '바로빌에서 아직 보내는 중',
    defaultReason: '바로빌에서 결과 통지가 아직 없습니다.',
  };
}

export function sanitizeBarobillReason(raw: string | null | undefined): string {
  const text = String(raw ?? '').trim();
  if (!text || /^sms-bytes:\d+$/.test(text)) return '';
  return text
    .replace(new RegExp(PHONE_SRC, 'g'), '')
    .replace(/CBISEO_[A-Z0-9_]+/gi, '')
    .replace(/\b(SendStatus|SmsSendState|SUCCESS|FAILED|FAIL|PENDING)\b/gi, '')
    .replace(/\d{6,}/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

export function publicTemplateTitle(
  code: string,
  storedName: string | null | undefined,
  knownNames: Record<string, string>,
): string {
  const stored = (storedName ?? '').trim();
  if (stored && !looksLikeCode(stored)) return stored;
  const known = (knownNames[code] ?? '').trim();
  if (known && !looksLikeCode(known)) return known;
  return '알림톡';
}

export function publicCustomerName(raw: string | null | undefined): string {
  const name = String(raw ?? '')
    .replace(new RegExp(PHONE_SRC, 'g'), '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!name || /\d{6,}/.test(name)) return '고객';
  return name.slice(0, 40);
}

export function publicInquiryNumber(raw: string | null | undefined): string | null {
  const value = String(raw ?? '').trim();
  if (!value || new RegExp(PHONE_SRC).test(value)) return null;
  return value.slice(0, 24);
}

export function formatKstSentStamp(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  const hour = pick('hour').padStart(2, '0');
  const minute = pick('minute').padStart(2, '0');
  return `${Number(pick('month'))}. ${Number(pick('day'))}. ${hour}:${minute}`;
}

export function unconfirmedTenantLabel(names: readonly string[]): string {
  const unique: string[] = [];
  for (const name of names) {
    const trimmed = name.trim();
    if (!trimmed || unique.includes(trimmed)) continue;
    unique.push(trimmed);
  }
  if (unique.length === 0) return '업체';
  if (unique.length === 1) return unique[0];
  return `${unique[0]} 외 ${unique.length - 1}곳`;
}

export function buildUnconfirmedMail(input: {
  total: number;
  tenantNames: readonly string[];
  items: readonly UnconfirmedMailItem[];
  overflow: number;
  memberBalanceKrw: number | null;
}): { subject: string; text: string } {
  const shown = input.items.slice(0, 20);
  const extra = input.overflow + Math.max(0, input.items.length - 20);
  const low = input.memberBalanceKrw != null && input.memberBalanceKrw < 10_000;
  const blocks = shown.map((item) => itemBlock(item, low ? input.memberBalanceKrw : null));
  if (extra > 0) blocks.push(`외 ${extra}건`);
  blocks.push(footer(low));
  const total = Math.max(0, input.total);
  return {
    subject: `[청소비서] 알림톡 결과 미확정 ${total}건 — ${unconfirmedTenantLabel(input.tenantNames)}`,
    text: blocks.join('\n\n'),
  };
}

function itemBlock(item: UnconfirmedMailItem, memberBalanceKrw: number | null): string {
  const inquiry = item.inquiryNumber ? ` · 접수번호 ${item.inquiryNumber}` : '';
  const reason = item.reason.trim() || '결과 설명이 아직 없습니다.';
  const lines = [
    `${item.tenantName} · ${item.templateName}`,
    `받는 고객: ${item.customerName} (${item.maskedPhone})${inquiry}`,
    `보낸 시각: ${formatKstSentStamp(item.sentAt)}`,
    `상태: ${item.statusLine}`,
    `사유: ${reason}`,
  ];
  if (memberBalanceKrw != null) {
    const won = Math.floor(memberBalanceKrw).toLocaleString('ko-KR');
    lines.push(`회원사 잔액 ${won}원 — 대체문자를 못 보냈을 수 있어요`);
  }
  return lines.join('\n');
}

function footer(lowBalance: boolean): string {
  const lines = [
    '아직 차감되지 않았어요.',
    '확인하는 곳: 플랫폼 → 알림톡 → 발송 내역',
    '확인하는 곳: 업체 화면 → 알림톡 → 발송 로그',
  ];
  if (lowBalance) lines.push('할 일: 바로빌 회원사 잔액 충전');
  return lines.join('\n');
}

function looksLikeCode(value: string): boolean {
  return /CBISEO_/i.test(value) || /^[A-Z0-9_]+$/.test(value);
}
