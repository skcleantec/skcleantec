/**
 * 해피콜·일정확인 알림톡 cron 진단 (운영 DB read-only)
 * cd server && npx tsx scripts/diagnose-happy-call-now.ts
 */
import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { runHappyCallReminderJob } from '../src/modules/notifications/happyCallReminder.service.js';
import { runAlimtalkScheduleD2Job } from '../src/modules/alimtalk/alimtalkScheduleD2.service.js';
import { kstTodayYmd } from '../src/modules/inquiries/inquiryListDateRange.js';
import {
  happyCallReminderWindowStart,
  isHappyCallInHourlyReminderWindow,
} from '../src/modules/inquiries/happyCall.helpers.js';
import { getTenantNotificationPolicy } from '../src/modules/notifications/notificationPolicy.service.js';
import { isFeatureEnabled } from '../src/modules/tenants/tenantFeatures.service.js';
import { ALIMTALK_MODULE_ID } from '../src/lib/alimtalkPolicy.js';
import { isTenantAlimtalkTemplateEnabled } from '../src/modules/alimtalk/alimtalkWallet.service.js';
import { resolveScheduleD2SendForInquiry } from '../src/modules/alimtalk/alimtalkScheduleD2.helpers.js';

const now = new Date();
const today = kstTodayYmd();

async function main() {
  console.log('=== KST now', now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }), '| today', today);

  const sk = await prisma.tenant.findFirst({
    where: { slug: 'sk' },
    select: { id: true, slug: true, plan: true, status: true },
  });
  console.log('\nSK tenant:', sk);
  if (!sk) {
    console.log('SK tenant not found');
    return;
  }

  const policy = await getTenantNotificationPolicy(sk.id);
  console.log('\nSK happy_call policy:', policy.kinds.happy_call);

  const alimLicensed = await isFeatureEnabled(sk.id, ALIMTALK_MODULE_ID);
  const scheduleD2On = await isTenantAlimtalkTemplateEnabled(sk.id, 'CBISEO_CUST_SCHEDULE_D2');
  console.log('SK alimtalk licensed:', alimLicensed, '| SCHEDULE_D2 template ON:', scheduleD2On);

  const assignments = await prisma.assignment.findMany({
    where: {
      tenantId: sk.id,
      inquiry: {
        happyCallCompletedAt: null,
        preferredDate: { not: null },
        status: {
          notIn: [
            'CANCELLED',
            'ON_HOLD',
            'PENDING',
            'DEPOSIT_PENDING',
            'DEPOSIT_COMPLETED',
            'ORDER_FORM_PENDING',
          ],
        },
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
          inquiryNumber: true,
        },
      },
      teamLeader: { select: { id: true, name: true, email: true, role: true } },
    },
    orderBy: { inquiry: { preferredDate: 'asc' } },
    take: 30,
  });

  console.log(`\n=== SK happy-call eligible assignments (up to ${assignments.length}) ===`);
  for (const a of assignments) {
    const pd = a.inquiry.preferredDate!;
    const inWindow = isHappyCallInHourlyReminderWindow(now, pd, null, a.inquiry.status);
    const winStart = happyCallReminderWindowStart(pd);
    const fcmTokens = await prisma.staffAppFcmToken.count({
      where: { userId: a.teamLeaderId, tenantId: sk.id },
    });
    console.log({
      inquiryNumber: a.inquiry.inquiryNumber,
      customer: a.inquiry.customerName,
      status: a.inquiry.status,
      preferredDateKst: pd.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10),
      teamLeader: a.teamLeader?.name || a.teamLeader?.email,
      role: a.teamLeader?.role,
      fcmTokens,
      reminderFrom: winStart.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      shouldNotifyNow: inWindow,
    });
  }

  const hcDry = await runHappyCallReminderJob({ dryRun: true });
  console.log('\n=== happy-call cron dryRun (all tenants) ===', hcDry);

  const alDry = await runAlimtalkScheduleD2Job({ dryRun: true });
  console.log('\n=== alimtalk schedule-d2 dryRun ===', alDry);

  const recentLogs = await prisma.notificationDeliveryLog.findMany({
    where: { tenantId: sk.id, kind: 'happy_call' },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { createdAt: true, userId: true, dedupeKey: true },
  });
  console.log('\n=== SK recent happy_call delivery logs ===', recentLogs);

  const alimLogs = await prisma.alimtalkSendLog.findMany({
    where: { tenantId: sk.id, templateCode: 'CBISEO_CUST_SCHEDULE_D2' },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: {
      createdAt: true,
      inquiryId: true,
      chargeStatus: true,
      errorMessage: true,
      deliveredChannel: true,
    },
  });
  console.log('\n=== SK recent SCHEDULE_D2 alimtalk logs ===', alimLogs);

  // Tomorrow's inquiries — alimtalk sendYmd check
  const tomorrowAssignments = assignments.filter((a) => {
    const ymd = a.inquiry.preferredDate!.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
    const tomorrow = new Date(`${today}T12:00:00+09:00`);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowYmd = tomorrow.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
    return ymd === tomorrowYmd;
  });
  if (tomorrowAssignments.length > 0) {
    console.log('\n=== Tomorrow service — SCHEDULE_D2 sendYmd ===');
    for (const a of tomorrowAssignments.slice(0, 5)) {
      const resolved = await resolveScheduleD2SendForInquiry(a.inquiry.id);
      console.log({
        inquiryNumber: a.inquiry.inquiryNumber,
        resolved: 'error' in resolved ? resolved.error : resolved,
      });
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
