import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { kstDayRangeYmd, kstTodayYmd } from '../src/modules/inquiries/inquiryListDateRange.js';
import { happyCallCronPreferredDateRange, isHappyCallInHourlyReminderWindow } from '../src/modules/inquiries/happyCall.helpers.js';

const SK = 'a0000000-0000-4000-8000-000000000001';
const now = new Date();
const tomorrow = (() => {
  const t = new Date(`${kstTodayYmd()}T12:00:00+09:00`);
  t.setDate(t.getDate() + 1);
  return t.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
})();

async function main() {
  const r = kstDayRangeYmd(tomorrow)!;
  const rows = await prisma.inquiry.findMany({
    where: { tenantId: SK, preferredDate: { gte: r.gte, lte: r.lte } },
    select: {
      inquiryNumber: true,
      customerName: true,
      status: true,
      preferredDate: true,
      happyCallCompletedAt: true,
      assignments: {
        select: { teamLeader: { select: { name: true, role: true } } },
      },
    },
  });
  console.log('cron range:', happyCallCronPreferredDateRange(now));
  console.log(`tomorrow inquiries: ${rows.length}\n`);
  for (const inv of rows) {
    console.log({
      inquiryNumber: inv.inquiryNumber,
      customer: inv.customerName,
      status: inv.status,
      hcDone: Boolean(inv.happyCallCompletedAt),
      teamLeaders: inv.assignments.map((a) => a.teamLeader?.name ?? '(none)'),
      assignmentCount: inv.assignments.length,
      inWindow: isHappyCallInHourlyReminderWindow(
        now,
        inv.preferredDate,
        inv.happyCallCompletedAt,
        inv.status,
      ),
    });
  }
}

main().finally(() => prisma.$disconnect());
