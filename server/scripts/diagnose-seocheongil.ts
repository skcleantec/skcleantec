/** 서청일 팀장 — 배정·해피콜·내일 일정 상세 */
import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { kstTodayYmd, kstDayRangeYmd } from '../src/modules/inquiries/inquiryListDateRange.js';
import {
  happyCallCronPreferredDateRange,
  isHappyCallInHourlyReminderWindow,
  isHappyCallEligible,
} from '../src/modules/inquiries/happyCall.helpers.js';

const SCI_ID = '5816a2cc-9b35-4deb-976f-c3494b266f6f';
const SK_ID = 'a0000000-0000-4000-8000-000000000001';
const now = new Date();
const today = kstTodayYmd();
const tomorrow = (() => {
  const t = new Date(`${today}T12:00:00+09:00`);
  t.setDate(t.getDate() + 1);
  return t.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
})();

async function main() {
  console.log('now KST:', now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }));
  console.log('today:', today, 'tomorrow:', tomorrow);
  console.log('cron range:', happyCallCronPreferredDateRange(now));

  for (const label of ['today', 'tomorrow'] as const) {
    const ymd = label === 'today' ? today : tomorrow;
    const r = kstDayRangeYmd(ymd);
    if (!r) continue;
    const rows = await prisma.assignment.findMany({
      where: { tenantId: SK_ID, teamLeaderId: SCI_ID, inquiry: { preferredDate: { gte: r.gte, lte: r.lte } } },
      select: {
        inquiry: {
          select: {
            inquiryNumber: true,
            customerName: true,
            status: true,
            preferredDate: true,
            happyCallCompletedAt: true,
          },
        },
      },
    });
    console.log(`\n=== 서청일 ${label} (${ymd}) assignments: ${rows.length} ===`);
    for (const row of rows) {
      const inv = row.inquiry;
      const pd = inv.preferredDate;
      console.log({
        inquiryNumber: inv.inquiryNumber,
        customer: inv.customerName,
        status: inv.status,
        preferredDateRaw: pd?.toISOString(),
        preferredDateKst: pd?.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10),
        happyCallDone: Boolean(inv.happyCallCompletedAt),
        eligible: pd ? isHappyCallEligible(inv.status, pd) : false,
        inWindow: pd
          ? isHappyCallInHourlyReminderWindow(now, pd, inv.happyCallCompletedAt, inv.status)
          : false,
      });
    }
  }

  const pendingHc = await prisma.assignment.findMany({
    where: {
      tenantId: SK_ID,
      teamLeaderId: SCI_ID,
      inquiry: { happyCallCompletedAt: null, preferredDate: { not: null } },
    },
    select: {
      inquiry: {
        select: {
          inquiryNumber: true,
          customerName: true,
          status: true,
          preferredDate: true,
        },
      },
    },
    orderBy: { inquiry: { preferredDate: 'asc' } },
    take: 15,
  });
  console.log('\n=== 서청일 미완 해피콜 (nearest 15 by date) ===');
  for (const row of pendingHc) {
    const inv = row.inquiry;
    const pd = inv.preferredDate!;
    console.log({
      inquiryNumber: inv.inquiryNumber,
      customer: inv.customerName,
      status: inv.status,
      preferredDateKst: pd.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10),
      inWindow: isHappyCallInHourlyReminderWindow(now, pd, null, inv.status),
    });
  }

  const logs = await prisma.notificationDeliveryLog.findMany({
    where: { tenantId: SK_ID, userId: SCI_ID, kind: 'happy_call' },
    orderBy: { sentAt: 'desc' },
    take: 5,
    select: { sentAt: true, dedupeKey: true },
  });
  console.log('\n=== 서청일 recent happy_call delivery logs ===', logs);

  const alLogs = await prisma.alimtalkSendLog.findMany({
    where: { tenantId: SK_ID, templateCode: 'CBISEO_CUST_SCHEDULE_D2' },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { createdAt: true, inquiryId: true, chargeStatus: true, errorMessage: true },
  });
  console.log('\n=== SK recent SCHEDULE_D2 (any) ===', alLogs);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
