import { prisma } from '../../lib/prisma.js';
import { sendPlatformMail } from '../../lib/platformSmtp.service.js';
import {
  notifyPlatformOps,
  platformAppBaseUrl,
  platformInboxAbsoluteUrl,
} from '../platform/platformInboxNotify.service.js';

/** shared/landingContactSourceLink.ts 와 같은 숫자. */
const FREE_SLOTS = 2;
const UNIT_KRW = 5_000;

const ROLE_LABEL: Record<string, string> = {
  ADMIN: '관리자',
  MARKETER: '마케터',
  TEAM_LEADER: '팀장',
  OFFICE_STAFF: '사무직',
  EXTERNAL_PARTNER: '타업체',
};

export function staffRoleLabel(role: string | null | undefined): string {
  if (!role) return '담당';
  return ROLE_LABEL[role] ?? '담당';
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (ch) => {
    if (ch === '&') return '&amp;';
    if (ch === '<') return '&lt;';
    if (ch === '>') return '&gt;';
    return '&quot;';
  });
}

export function formatKstStamp(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('month')}.${get('day')} ${get('hour')}:${get('minute')}`;
}

function kstMonth(date: Date): number {
  return Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', month: 'numeric' }).format(date),
  );
}

/** 이번 달 청구서가 있으면 다음 달, 없으면 이번 달. */
export function linkBillingPhrase(invoiceAlreadyIssued: boolean, now = new Date()): string {
  const month = kstMonth(now);
  const next = month === 12 ? 1 : month + 1;
  if (invoiceAlreadyIssued) {
    return `${next}월 이용료부터 (${month}월 청구서는 이미 발행됨)`;
  }
  return `${month}월 이용료부터`;
}

export function linkMonthlyKrw(count: number): number {
  return Math.max(0, count) * UNIT_KRW;
}

export type LinkUsage = {
  activeFree: number;
  freeIncluded: number;
  approvedPaid: number;
  invoiceAlreadyIssued: boolean;
  billingPhrase: string;
};

export async function loadLinkUsage(tenantIds: string[]): Promise<Map<string, LinkUsage>> {
  const ids = [...new Set(tenantIds.filter(Boolean))];
  const now = new Date();
  const empty = (issued: boolean): LinkUsage => ({
    activeFree: 0,
    freeIncluded: FREE_SLOTS,
    approvedPaid: 0,
    invoiceAlreadyIssued: issued,
    billingPhrase: linkBillingPhrase(issued, now),
  });
  const map = new Map<string, LinkUsage>();
  for (const id of ids) map.set(id, empty(false));
  if (ids.length === 0) return map;

  const [freeGroups, approvedRows, invoices] = await Promise.all([
    prisma.landingContactSourceLink.groupBy({
      by: ['tenantId'],
      where: { tenantId: { in: ids }, slotKind: 'FREE', isActive: true },
      _count: { _all: true },
    }),
    prisma.landingContactLinkSlotRequest.findMany({
      where: { tenantId: { in: ids }, status: 'APPROVED' },
      select: { tenantId: true, requestedCount: true },
    }),
    prisma.tenantInvoice.findMany({
      where: {
        tenantId: { in: ids },
        status: { not: 'VOID' },
        periodStart: { lte: now },
        periodEnd: { gt: now },
      },
      select: { tenantId: true },
    }),
  ]);

  const issued = new Set(invoices.map((row) => row.tenantId));
  for (const id of ids) {
    const row = map.get(id)!;
    row.invoiceAlreadyIssued = issued.has(id);
    row.billingPhrase = linkBillingPhrase(row.invoiceAlreadyIssued, now);
  }
  for (const group of freeGroups) {
    const row = map.get(group.tenantId);
    if (row) row.activeFree = group._count._all;
  }
  for (const row of approvedRows) {
    const usage = map.get(row.tenantId);
    if (usage) usage.approvedPaid += Math.max(0, row.requestedCount);
  }
  return map;
}

export async function notifyLandingLinkPurchaseRequested(input: {
  tenantId: string;
  tenantName: string;
  count: number;
  requestedAt: Date;
  requesterLabel: string;
  message: string | null;
  usage: LinkUsage;
}): Promise<void> {
  const when = formatKstStamp(input.requestedAt);
  const monthly = linkMonthlyKrw(input.count).toLocaleString('ko-KR');
  const note = input.message?.trim() || '없음';
  const url = platformInboxAbsoluteUrl();
  const lead = `${input.tenantName}이 문의 링크 ${input.count}개 추가를 요청했어요.`;
  const lines = [
    `요청 ${when} · ${input.requesterLabel}`,
    `지금 무료 ${input.usage.activeFree}/${input.usage.freeIncluded} · 구매 ${input.usage.approvedPaid}개`,
    `승인하면 월 ${monthly}원 (${input.usage.billingPhrase})`,
    `남긴 말: ${note}`,
  ];
  const text = [lead, '', ...lines, '', `오늘 할 일에서 처리하기 → ${url}`].join('\n');
  const html = [
    `<p>${escapeHtml(lead)}</p>`,
    `<p>${lines.map((line) => escapeHtml(line)).join('<br>')}</p>`,
    `<p><a href="${escapeHtml(url)}">오늘 할 일에서 처리하기 → ${escapeHtml(url)}</a></p>`,
  ].join('');
  await notifyPlatformOps({
    event: 'link_slot',
    tenantId: input.tenantId,
    title: `문의 링크 ${input.count}개 추가 구매`,
    body: `${input.count}개 · 월 ${monthly}원`,
    mailText: text,
    mailHtml: html,
  });
}

export async function notifyLandingLinkPurchaseResult(input: {
  to: string | null;
  approved: boolean;
  count: number;
  reason: string | null;
  billingPhrase: string;
}): Promise<void> {
  const email = input.to?.trim() ?? '';
  if (!email.includes('@')) {
    console.info('[landing-link] result mail skipped');
    return;
  }
  const url = `${platformAppBaseUrl()}/admin/inquiries/leads/settings`;
  const monthly = linkMonthlyKrw(input.count).toLocaleString('ko-KR');
  const subject = input.approved
    ? `[청소비서] 문의 링크 ${input.count}개가 추가됐어요`
    : '[청소비서] 문의 링크 추가 요청이 반려됐어요';
  const lead = input.approved
    ? `요청하신 문의 링크 ${input.count}개를 추가했어요. 지금 바로 새 링크를 만들 수 있어요.`
    : '문의 링크 추가 요청이 반려됐어요.';
  const next = input.approved
    ? `${input.billingPhrase.split(' (')[0]} 월 ${monthly}원이 더해져요.`
    : `사유: ${input.reason?.trim() || ''}`;
  const text = [lead, next, '', `문의 링크 열기 → ${url}`].join('\n');
  const html = `<p>${escapeHtml(lead)}</p><p>${escapeHtml(next)}</p><p><a href="${escapeHtml(url)}">문의 링크 열기 → ${escapeHtml(url)}</a></p>`;
  try {
    const result = await sendPlatformMail({ to: email, subject, text, html });
    console.info(`[landing-link] result mail ${result.sent ? 'sent' : 'skipped'}`);
  } catch (err) {
    console.error('[landing-link] result mail', err instanceof Error ? err.name : 'error');
  }
}

export async function landingLinkResultEmail(tenantId: string, requesterUserId: string | null): Promise<string | null> {
  if (requesterUserId) {
    const requester = await prisma.user.findFirst({
      where: { id: requesterUserId, tenantId },
      select: { email: true },
    });
    if (requester?.email.includes('@')) return requester.email;
  }
  const owner = await prisma.user.findFirst({
    where: { tenantId, isActive: true, OR: [{ isTenantOwner: true }, { role: 'ADMIN' }] },
    orderBy: [{ isTenantOwner: 'desc' }, { createdAt: 'asc' }],
    select: { email: true },
  });
  return owner?.email.includes('@') ? owner.email : null;
}
