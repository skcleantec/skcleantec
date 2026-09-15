/**
 * SK 해피콜·일정확인 — 오늘/내일 예약만 집중 진단
 * cd server && npx tsx scripts/diagnose-happy-call-sk-today.ts
 */
import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { kstTodayYmd } from '../src/modules/inquiries/inquiryListDateRange.js';
import {
  happyCallCronPreferredDateRange,
  happyCallReminderWindowStart,
  isHappyCallInHourlyReminderWindow,
} from '../src/modules/inquiries/happyCall.helpers.js';
import { runHappyCallReminderJob } from '../src/modules/notifications/happyCallReminder.service.js';
import { canReceiveHappyCallPush } from '../src/lib/staffAppPush.helpers.js';
import { resolveScheduleD2SendForInquiry } from '../src/modules/alimtalk/alimtalkScheduleD2.helpers.js';

const now = new Date();
const today = kstTodayYmd();

async function main() {
  const sk = await prisma.tenant.findFirst({ where: { slug: 'sk' }, select: { id: true } });
  if (!sk) {
    console.log('SK not found');
    return;
  }

  const range = happyCallCronPreferredDateRange(now);
  console.log('KST now:', now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }));
  console.log('today:', today, '| cron preferredDate range:', range);

  const leaders = await prisma.user.findMany({
    where: {
      tenantId: sk.id,
      OR: [{ name: { contains: '청일' } }, { email: { contains: '청일' } }],
    },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });
  console.log('\n=== Users matching 청일 ===', leaders);

  for (const u of leaders) {
    const fcm = await prisma.staffAppFcmToken.count({ where: { tenantId: sk.id, userId: u.id } });
    console.log(`FCM tokens for ${u.name}:`, fcm);
  }

  if (!range) {
    console.log('No cron range');
    return;
  }

  const assignments = await prisma.assignment.findMany({
    where: {
      tenantId: sk.id,
      inquiry: {
        preferredDate: { gte: range.gte, lte: range.lte },
        happyCallCompletedAt: null,
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
          inquiryNumber: true,
          customerName: true,
          status: true,
          preferredDate: true,
          happyCallCompletedAt: true,
        },
      },
      teamLeader: { select: { id: true, name: true, role: true } },
    },
    orderBy: { inquiry: { preferredDate: 'asc' } },
  });

  console.log(`\n=== SK in-range happy-call candidates: ${assignments.length} ===`);
  for (const a of assignments) {
    const pd = a.inquiry.preferredDate!;
    const ymd = pd.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
    const inWindow = isHappyCallInHourlyReminderWindow(
      now,
      pd,
      a.inquiry.happyCallCompletedAt,
      a.inquiry.status,
    );
    const fcm = await prisma.staffAppFcmToken.count({
      where: { tenantId: sk.id, userId: a.teamLeaderId },
    });
    const canPush = canReceiveHappyCallPush(a.teamLeader?.role);
    console.log({
      inquiryNumber: a.inquiry.inquiryNumber,
      customer: a.inquiry.customerName,
      preferredDateKst: ymd,
      teamLeader: a.teamLeader?.name,
      role: a.teamLeader?.role,
      canReceivePush: canPush,
      fcmTokens: fcm,
      inReminderWindow: inWindow,
      reminderFrom: happyCallReminderWindowStart(pd).toLocaleString('ko-KR', {
        timeZone: 'Asia/Seoul',
      }),
    });
  }

  const tomorrowYmd = (() => {
    const t = new Date(`${today}T12:00:00+09:00`);
    t.setDate(t.getDate() + 1);
    return t.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
  })();
  const tomorrowRows = assignments.filter((a) => {
    const ymd = a.inquiry.preferredDate!.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
    return ymd === tomorrowYmd;
  });
  console.log(`\n=== Tomorrow (${tomorrowYmd}) SCHEDULE_D2 alimtalk check ===`);
  for (const a of tomorrowRows.slice(0, 10)) {
    const resolved = await resolveScheduleD2SendForInquiry(a.inquiry.id);
    console.log({
      inquiryNumber: a.inquiry.inquiryNumber,
      customer: a.inquiry.customerName,
      teamLeader: a.teamLeader?.name,
      scheduleD2: 'error' in resolved ? resolved.error : resolved,
    });
  }

  const hcSk = await runHappyCallReminderJob({ dryRun: true });
  console.log('\n=== happy-call dryRun (all tenants) ===', hcSk);

  const recentHc = await prisma.notificationDeliveryLog.findMany({
    where: { tenantId: sk.id, kind: 'happy_call', createdAt: { gte: new Date(Date.now() - 24 * 3600_000) } },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { createdAt: true, userId: true, dedupeKey: true },
  });
  console.log('\n=== SK happy_call logs (24h) ===', recentHc);

  const recentAl = await prisma.alimtalkSendLog.findMany({
    where: {
      tenantId: sk.id,
      templateCode: 'CBISEO_CUST_SCHEDULE_D2',
      createdAt: { gte: new Date(Date.now() - 24 * 3600_000) },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { createdAt: true, inquiryId: true, chargeStatus: true, errorMessage: true },
  });
  console.log('\n=== SK SCHEDULE_D2 alimtalk logs (24h) ===', recentAl);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
