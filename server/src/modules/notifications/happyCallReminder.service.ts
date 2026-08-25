import { prisma } from '../../lib/prisma.js';
import {
  happyCallReminderWindowStart,
  isHappyCallEligible,
  isHappyCallInHourlyReminderWindow,
  isHappyCallOverdue,
} from '../inquiries/happyCall.helpers.js';
import { buildHappyCallPushPayload } from '../../lib/staffAppPush.helpers.js';
import { notifyInboxRefresh } from '../realtime/inboxNotify.js';
import {
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

/** 15분 cron — 전날 18:00 KST부터 미완 시 시간당 1회 (완료까지) */
export async function runHappyCallReminderJob(opts?: {
  dryRun?: boolean;
}): Promise<HappyCallReminderJobResult> {
  const dryRun = Boolean(opts?.dryRun);
  const now = new Date();
  let pushesSent = 0;
  let skipped = 0;

  const tenants = await prisma.tenant.findMany({
    where: { status: { in: ['ACTIVE', 'TRIAL'] } },
    select: { id: true },
  });

  for (const tenant of tenants) {
    const policy = await getTenantNotificationPolicy(tenant.id);
    const rule = policy.kinds.happy_call;
    if (!rule?.enabled || !rule.repeatEnabled) continue;

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
      if (!isHappyCallInHourlyReminderWindow(now, inv.preferredDate, inv.happyCallCompletedAt, inv.status)) {
        skipped += 1;
        continue;
      }

      const leaderId = row.teamLeaderId;
      const windowStart = happyCallReminderWindowStart(inv.preferredDate);
      const hourIndex = Math.floor((now.getTime() - windowStart.getTime()) / 3_600_000);
      if (hourIndex < 0) {
        skipped += 1;
        continue;
      }

      const dedupeKey = `happy_call:${inv.id}:hourly:${hourIndex}`;
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

      const userPref = await getUserNotificationPreferences(tenant.id, leaderId);
      if (!shouldSendPushToUser('happy_call', policy, userPref)) {
        skipped += 1;
        continue;
      }

      const overdue = isHappyCallOverdue(now, inv.preferredDate, inv.happyCallCompletedAt, inv.status);
      const payload = buildHappyCallPushPayload({
        customerName: inv.customerName,
        inquiryId: inv.id,
        variant: overdue ? 'overdue' : 'reminder',
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
