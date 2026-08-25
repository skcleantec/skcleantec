import { prisma } from '../../lib/prisma.js';
import {
  happyCallDeadlineEnd,
  isHappyCallEligible,
  isHappyCallOverdue,
} from '../inquiries/happyCall.helpers.js';
import { buildHappyCallPushPayload } from '../../lib/staffAppPush.helpers.js';
import { notifyInboxRefresh } from '../realtime/inboxNotify.js';
import {
  countNotificationDeliveries,
  getLatestNotificationDelivery,
  getTenantNotificationPolicy,
  getUserNotificationPreferences,
  recordNotificationDelivery,
} from './notificationPolicy.service.js';
import { shouldSendPushToUser } from '../../lib/notificationPolicy.helpers.js';

export type HappyCallReminderJobResult = {
  tenantsScanned: number;
  pushesSent: number;
  skipped: number;
  dryRun: boolean;
};

export async function runHappyCallReminderJob(opts?: {
  dryRun?: boolean;
}): Promise<HappyCallReminderJobResult> {
  const dryRun = Boolean(opts?.dryRun);
  const now = new Date();
  let pushesSent = 0;
  let skipped = 0;

  const tenants = await prisma.tenant.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true },
  });

  for (const tenant of tenants) {
    const policy = await getTenantNotificationPolicy(tenant.id);
    const rule = policy.kinds.happy_call;
    if (!rule?.enabled) continue;

    const assignments = await prisma.assignment.findMany({
      where: { tenantId: tenant.id },
      select: {
        teamLeaderId: true,
        inquiry: {
          select: {
            id: true,
            customerName: true,
            status: true,
            preferredDate: true,
            happyCallCompletedAt: true,
          },
        },
      },
    });

    for (const row of assignments) {
      const inv = row.inquiry;
      if (!inv?.preferredDate) continue;
      if (!isHappyCallEligible(inv.status, inv.preferredDate)) continue;
      if (inv.happyCallCompletedAt) continue;

      const leaderId = row.teamLeaderId;
      const deadline = happyCallDeadlineEnd(inv.preferredDate);
      const overdue = isHappyCallOverdue(now, inv.preferredDate, inv.happyCallCompletedAt, inv.status);

      let variant: 'reminder' | 'overdue' | null = null;
      let dedupeKey: string | null = null;

      if (overdue && rule.repeatEnabled) {
        const prefix = `happy_call:${inv.id}:overdue:`;
        const sentCount = await countNotificationDeliveries({
          tenantId: tenant.id,
          userId: leaderId,
          dedupeKeyPrefix: prefix,
        });
        if (sentCount >= rule.repeatMaxPerInquiry) {
          skipped += 1;
          continue;
        }
        const lastSent = await getLatestNotificationDelivery({
          tenantId: tenant.id,
          userId: leaderId,
          dedupeKeyPrefix: prefix,
        });
        if (lastSent) {
          const elapsedMin = (now.getTime() - lastSent.getTime()) / 60_000;
          if (elapsedMin < rule.repeatIntervalMinutes) {
            skipped += 1;
            continue;
          }
        }
        variant = 'overdue';
        dedupeKey = `${prefix}${sentCount + 1}`;
      } else if (!overdue && rule.remindBeforeDeadlineMinutes.length > 0) {
        const msUntilDeadline = deadline.getTime() - now.getTime();
        if (msUntilDeadline <= 0) continue;
        const minutesLeft = msUntilDeadline / 60_000;
        const matched = rule.remindBeforeDeadlineMinutes.find(
          (m) => minutesLeft <= m && minutesLeft > m - 20,
        );
        if (!matched) continue;
        dedupeKey = `happy_call:${inv.id}:remind:${matched}`;
        const existing = await prisma.notificationDeliveryLog.findUnique({
          where: {
            tenantId_userId_dedupeKey: {
              tenantId: tenant.id,
              userId: leaderId,
              dedupeKey,
            },
          },
          select: { id: true },
        });
        if (existing) {
          skipped += 1;
          continue;
        }
        variant = 'reminder';
      } else {
        continue;
      }

      if (!variant || !dedupeKey) continue;

      const userPref = await getUserNotificationPreferences(tenant.id, leaderId);
      if (!shouldSendPushToUser('happy_call', policy, userPref)) {
        skipped += 1;
        continue;
      }

      const payload = buildHappyCallPushPayload({
        customerName: inv.customerName,
        inquiryId: inv.id,
        variant,
      });

      if (!dryRun) {
        await notifyInboxRefresh([leaderId], { [leaderId]: payload });
        await recordNotificationDelivery({
          tenantId: tenant.id,
          userId: leaderId,
          kind: 'happy_call',
          dedupeKey,
        });
      }
      pushesSent += 1;
    }
  }

  return {
    tenantsScanned: tenants.length,
    pushesSent,
    skipped,
    dryRun,
  };
}
