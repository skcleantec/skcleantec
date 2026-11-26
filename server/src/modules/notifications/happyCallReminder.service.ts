import { prisma } from '../../lib/prisma.js';
import {
  happyCallCronPreferredDateRange,
  happyCallPushDedupeKey,
  HAPPY_CALL_INELIGIBLE_STATUSES,
  isHappyCallEligible,
  isHappyCallInHourlyReminderWindow,
  isHappyCallOverdue,
  isHappyCallPushGapElapsed,
} from '../inquiries/happyCall.helpers.js';
import { buildHappyCallPushPayload, canReceiveHappyCallPush } from '../../lib/staffAppPush.helpers.js';
import { notifyInboxRefresh } from '../realtime/inboxNotify.js';
import {
  claimNotificationDelivery,
  getLatestNotificationDeliveryRow,
  getTenantNotificationPolicy,
  getUserNotificationPreferences,
} from './notificationPolicy.service.js';
import { shouldSendPushToUser } from '../../lib/notificationPolicy.helpers.js';
import { isFeatureEnabled } from '../tenants/tenantFeatures.service.js';
import { resolveFieldOwnerIds } from '../../lib/fieldOwner.js';

export type HappyCallReminderJobResult = {
  tenantsScanned: number;
  pushesSent: number;
  skipped: number;
  dryRun: boolean;
};

type HappyCallTarget = {
  id: string;
  customerName: string;
  status: string;
  preferredDate: Date | null;
  happyCallCompletedAt: Date | null;
  createdAt: Date;
};

/** 기록을 먼저 만들고, 그 기록이 새로 생겼을 때만 푸시한다. dryRun 은 기록도 푸시도 하지 않는다. */
async function sendHappyCallPush(params: {
  dryRun: boolean;
  now: Date;
  tenantId: string;
  userId: string;
  policy: Awaited<ReturnType<typeof getTenantNotificationPolicy>>;
  inquiry: HappyCallTarget;
  path?: string;
}): Promise<'sent' | 'skipped'> {
  const inv = params.inquiry;
  if (!inv.preferredDate) return 'skipped';
  const last = await getLatestNotificationDeliveryRow({
    tenantId: params.tenantId,
    userId: params.userId,
    dedupeKeyPrefix: `happy_call:${inv.id}:`,
  });
  if (!isHappyCallPushGapElapsed(params.now, last?.sentAt ?? null)) return 'skipped';
  const userPref = await getUserNotificationPreferences(params.tenantId, params.userId);
  if (!shouldSendPushToUser('happy_call', params.policy, userPref)) return 'skipped';
  const dedupeKey = happyCallPushDedupeKey(inv.id, last?.id ?? null);
  const overdue = isHappyCallOverdue(
    params.now,
    inv.preferredDate,
    inv.happyCallCompletedAt,
    inv.status,
    inv.createdAt,
  );
  const payload = buildHappyCallPushPayload({
    customerName: inv.customerName,
    inquiryId: inv.id,
    variant: overdue ? 'overdue' : 'reminder',
    path: params.path,
  });
  if (params.dryRun) return 'sent';
  const claimed = await claimNotificationDelivery({
    tenantId: params.tenantId,
    userId: params.userId,
    kind: 'happy_call',
    dedupeKey,
  });
  if (!claimed) return 'skipped';
  await notifyInboxRefresh([params.userId], { [params.userId]: payload });
  return 'sent';
}

/** 15분 cron — 작업 전날 18:00~23:59(KST)에만, 마지막 발송 후 55분마다 */
export async function runHappyCallReminderJob(opts?: {
  dryRun?: boolean;
}): Promise<HappyCallReminderJobResult> {
  const dryRun = Boolean(opts?.dryRun);
  const now = new Date();
  const preferredDateRange = happyCallCronPreferredDateRange(now);
  if (!preferredDateRange) {
    return { tenantsScanned: 0, pushesSent: 0, skipped: 0, dryRun };
  }
  let pushesSent = 0;
  let skipped = 0;

  const tenants = await prisma.tenant.findMany({
    where: { status: { in: ['ACTIVE', 'TRIAL'] } },
    select: { id: true },
  });

  for (const tenant of tenants) {
    const policy = await getTenantNotificationPolicy(tenant.id);
    const rule = policy.kinds.happy_call;
    if (!rule?.enabled) continue;

    const assignments = await prisma.assignment.findMany({
      where: {
        tenantId: tenant.id,
        inquiry: {
          preferredDate: { gte: preferredDateRange.gte, lte: preferredDateRange.lte },
          happyCallCompletedAt: null,
          status: { notIn: [...HAPPY_CALL_INELIGIBLE_STATUSES] },
        },
      },
      select: {
        teamLeaderId: true,
        inquiry: {
          select: {
            id: true,
            customerName: true,
            status: true,
            preferredDate: true,
            happyCallCompletedAt: true,
            createdAt: true,
          },
        },
      },
    });

    const leaderIds = [...new Set(assignments.map((a) => a.teamLeaderId))];
    const leaderRows =
      leaderIds.length > 0
        ? await prisma.user.findMany({
            where: { tenantId: tenant.id, id: { in: leaderIds } },
            select: { id: true, role: true },
          })
        : [];
    const leaderRoleById = new Map(leaderRows.map((u) => [u.id, u.role]));

    for (const row of assignments) {
      const inv = row.inquiry;
      if (!inv?.preferredDate) continue;
      if (!isHappyCallEligible(inv.status, inv.preferredDate)) continue;
      if (inv.happyCallCompletedAt) continue;
      if (
        !isHappyCallInHourlyReminderWindow(
          now,
          inv.preferredDate,
          inv.happyCallCompletedAt,
          inv.status,
          inv.createdAt,
        )
      ) {
        skipped += 1;
        continue;
      }

      const leaderId = row.teamLeaderId;
      if (!canReceiveHappyCallPush(leaderRoleById.get(leaderId))) {
        skipped += 1;
        continue;
      }
      const outcome = await sendHappyCallPush({
        dryRun,
        now,
        tenantId: tenant.id,
        userId: leaderId,
        policy,
        inquiry: inv,
      });
      if (outcome === 'sent') pushesSent += 1;
      else skipped += 1;
    }

    if (await isFeatureEnabled(tenant.id, 'core_assignments')) continue;

    const soloInquiries = await prisma.inquiry.findMany({
      where: {
        tenantId: tenant.id,
        preferredDate: { gte: preferredDateRange.gte, lte: preferredDateRange.lte },
        happyCallCompletedAt: null,
        status: { notIn: [...HAPPY_CALL_INELIGIBLE_STATUSES] },
        assignments: { none: {} },
      },
      select: {
        id: true,
        customerName: true,
        status: true,
        preferredDate: true,
        happyCallCompletedAt: true,
        createdAt: true,
      },
    });
    for (const inv of soloInquiries) {
      if (!inv.preferredDate) continue;
      if (!isHappyCallEligible(inv.status, inv.preferredDate)) continue;
      if (
        !isHappyCallInHourlyReminderWindow(
          now,
          inv.preferredDate,
          inv.happyCallCompletedAt,
          inv.status,
          inv.createdAt,
        )
      ) {
        skipped += 1;
        continue;
      }
      const ownerIds = await resolveFieldOwnerIds(tenant.id, inv.id);
      for (const ownerId of ownerIds) {
        const outcome = await sendHappyCallPush({
          dryRun,
          now,
          tenantId: tenant.id,
          userId: ownerId,
          policy,
          inquiry: inv,
          path: `/admin/inquiries?openInquiry=${encodeURIComponent(inv.id)}`,
        });
        if (outcome === 'sent') pushesSent += 1;
        else skipped += 1;
      }
    }
  }

  return {
    tenantsScanned: tenants.length,
    pushesSent,
    skipped,
    dryRun,
  };
}
