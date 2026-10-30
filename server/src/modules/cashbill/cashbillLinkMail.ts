import { maskCorpNum } from '../../lib/barobill/mask.js';
import { sendPlatformMail } from '../../lib/platformSmtp.service.js';
import {
  notifyPlatformOps,
  platformAppBaseUrl,
  platformInboxAbsoluteUrl,
} from '../platform/platformInboxNotify.service.js';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (ch) => {
    if (ch === '&') return '&amp;';
    if (ch === '<') return '&lt;';
    if (ch === '>') return '&gt;';
    return '&quot;';
  });
}

/** 메일·처리 카드용. 앞 5자리만 보이고 나머지는 가운데점. */
export function maskCorpNumDots(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 5) return '***-**-·····';
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-·····`;
}

export function formatKstMinute(date: Date): string {
  const text = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
  return text.replace('T', ' ').slice(0, 16);
}

export async function notifyBarobillLinkRequested(input: {
  tenantId: string;
  tenantName: string;
  corpNum: string;
  requestedAt: Date;
  hint: string | null;
}): Promise<void> {
  const masked = maskCorpNumDots(input.corpNum);
  const when = formatKstMinute(input.requestedAt);
  const hintLabel = input.hint?.trim() || '적지 않음';
  const url = platformInboxAbsoluteUrl();
  const lead = `${input.tenantName}이 바로빌 연결을 요청했어요.`;
  const text = [
    lead,
    '',
    `사업자번호: ${masked}`,
    `요청 시각: ${when}`,
    `바로빌 아이디: ${hintLabel}`,
    '',
    `오늘 할 일에서 처리하기 → ${url}`,
  ].join('\n');
  const html = [
    `<p>${escapeHtml(lead)}</p>`,
    `<p>사업자번호: ${escapeHtml(masked)}<br>요청 시각: ${escapeHtml(when)}<br>바로빌 아이디: ${escapeHtml(hintLabel)}</p>`,
    `<p><a href="${escapeHtml(url)}">오늘 할 일에서 처리하기 → ${escapeHtml(url)}</a></p>`,
  ].join('');
  await notifyPlatformOps({
    event: 'barobill_link',
    tenantId: input.tenantId,
    title: '바로빌 연결 요청',
    body: maskCorpNum(input.corpNum),
    mailText: text,
    mailHtml: html,
  });
}

export async function notifyBarobillLinkCompleted(input: {
  to: string;
  tenantName: string;
}): Promise<void> {
  const email = input.to.trim();
  if (!email.includes('@')) return;
  const url = `${platformAppBaseUrl()}/admin/team-leaders/cashbill`;
  const lead = `${input.tenantName}의 바로빌 연결을 마쳤어요. 지금부터 현금영수증을 발행할 수 있어요.`;
  const next = '세금계산서는 공동인증서를 한 번 등록하면 발행할 수 있어요.';
  const text = [lead, next, '', `계산서 연결 화면 열기 → ${url}`].join('\n');
  const html = `<p>${escapeHtml(lead)}</p><p>${escapeHtml(next)}</p><p><a href="${escapeHtml(url)}">계산서 연결 화면 열기 → ${escapeHtml(url)}</a></p>`;
  await sendPlatformMail({
    to: email,
    subject: '[청소비서] 바로빌 연결이 끝났어요',
    text,
    html,
  });
}
