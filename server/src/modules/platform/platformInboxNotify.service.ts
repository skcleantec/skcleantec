import { prisma } from '../../lib/prisma.js';
import { parsePaymentNotifyEmailsFromSettings } from '../../lib/platformBillingNotifyEmails.js';
import { sendPlatformMail } from '../../lib/platformSmtp.service.js';
import { broadcastJsonToPlatform } from '../realtime/realtimeHub.js';

export type PlatformOpsEvent =
  | 'wallet_charge'
  | 'payment_confirm'
  | 'plan_upgrade'
  | 'pg_submit'
  | 'barobill_review'
  | 'barobill_link'
  | 'link_slot'
  | 'signup_inquiry';

export function platformAppBaseUrl(): string {
  return (process.env.PUBLIC_APP_URL || 'https://www.cbiseo.com').replace(/\/$/, '');
}

export function platformInboxAbsoluteUrl(): string {
  return `${platformAppBaseUrl()}/platform/inbox`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (ch) => {
    if (ch === '&') return '&amp;';
    if (ch === '<') return '&lt;';
    if (ch === '>') return '&gt;';
    return '&quot;';
  });
}

export async function notifyPlatformOps(input: {
  event: PlatformOpsEvent;
  tenantId?: string | null;
  tenantLabel?: string;
  title: string;
  body: string;
  /** 이미 운영 메일을 보낸 이벤트는 화면 알림만 보낸다. */
  email?: boolean;
  mailText?: string;
  mailHtml?: string;
}): Promise<void> {
  const tenant = input.tenantId
    ? await prisma.tenant.findFirst({
        where: { id: input.tenantId },
        select: { name: true },
      })
    : null;
  const tenantName = tenant?.name?.trim() || input.tenantLabel?.trim() || '업체';
  const inboxUrl = platformInboxAbsoluteUrl();
  const summary = `${tenantName} · ${input.body}`;
  broadcastJsonToPlatform({
    type: 'platform:alert',
    event: input.event,
    title: input.title,
    body: summary,
    href: '/platform/inbox',
    at: new Date().toISOString(),
  });
  if (input.email === false) return;

  const settings = await prisma.platformBillingSettings.findFirst({
    select: { dunningPaymentNotifyEmails: true, dunningPaymentNotifyEmail: true },
  });
  const recipients = settings ? parsePaymentNotifyEmailsFromSettings(settings) : [];
  if (recipients.length === 0) {
    console.info('[platform-inbox] 운영 알림 이메일이 없어 메일은 생략합니다.');
    return;
  }
  const text = input.mailText ?? `${input.title}\n${summary}\n오늘 할 일에서 처리하기 → ${inboxUrl}`;
  const html = input.mailHtml ?? `<p>${escapeHtml(input.title)}</p><p>${escapeHtml(summary)}</p><p><a href="${escapeHtml(inboxUrl)}">오늘 할 일에서 처리하기</a></p>`;
  await Promise.all(
    recipients.map((to) =>
      sendPlatformMail({
        to,
        subject: `[청소비서] ${input.title} — ${tenantName}`,
        text,
        html,
      }).catch((err) => {
        console.error('[platform-inbox mail]', err instanceof Error ? err.name : 'error');
        return { sent: false };
      }),
    ),
  );
}
