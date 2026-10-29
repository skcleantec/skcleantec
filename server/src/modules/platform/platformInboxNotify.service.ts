import { prisma } from '../../lib/prisma.js';
import { parsePaymentNotifyEmailsFromSettings } from '../../lib/platformBillingNotifyEmails.js';
import { sendPlatformMail } from '../../lib/platformSmtp.service.js';
import { broadcastJsonToPlatform } from '../realtime/realtimeHub.js';

export type PlatformOpsEvent =
  | 'wallet_charge'
  | 'payment_confirm'
  | 'plan_upgrade'
  | 'pg_submit'
  | 'barobill_review';

export async function notifyPlatformOps(input: {
  event: PlatformOpsEvent;
  tenantId: string;
  title: string;
  body: string;
  /** 이미 운영 메일을 보낸 이벤트는 화면 알림만 보낸다. */
  email?: boolean;
}): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: input.tenantId },
    select: { name: true },
  });
  const tenantName = tenant?.name?.trim() || '업체';
  const body = `${tenantName} · ${input.body}`;
  const escape = (value: string) =>
    value.replace(/[&<>]/g, (ch) => (ch === '&' ? '&amp;' : ch === '<' ? '&lt;' : '&gt;'));
  broadcastJsonToPlatform({
    type: 'platform:alert',
    event: input.event,
    title: input.title,
    body,
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
  await Promise.all(
    recipients.map((to) =>
      sendPlatformMail({
        to,
        subject: `[청소비서] ${input.title} — ${tenantName}`,
        text: `${input.title}\n${body}\n오늘 할 일: /platform/inbox`,
        html: `<p>${escape(input.title)}</p><p>${escape(body)}</p>`,
      }).catch((err) => {
        console.error('[platform-inbox mail]', err);
        return { sent: false };
      }),
    ),
  );
}
