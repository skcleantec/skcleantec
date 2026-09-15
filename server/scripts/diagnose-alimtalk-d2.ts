import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { kstDayRangeYmd, kstTodayYmd } from '../src/modules/inquiries/inquiryListDateRange.js';
import { runAlimtalkScheduleD2Job } from '../src/modules/alimtalk/alimtalkScheduleD2.service.js';

const SK = 'a0000000-0000-4000-8000-000000000001';
const tomorrow = (() => {
  const t = new Date(`${kstTodayYmd()}T12:00:00+09:00`);
  t.setDate(t.getDate() + 1);
  return t.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
})();

async function main() {
  const r = kstDayRangeYmd(tomorrow);
  if (!r) return;
  const rows = await prisma.inquiry.findMany({
    where: { tenantId: SK, preferredDate: { gte: r.gte, lte: r.lte } },
    select: {
      inquiryNumber: true,
      customerName: true,
      status: true,
      customerPhone: true,
      orderFormId: true,
    },
  });
  console.log(`SK tomorrow (${tomorrow}) inquiries:`, rows.length);
  console.log(rows.slice(0, 10));

  const d2 = await runAlimtalkScheduleD2Job({ dryRun: true });
  console.log('\nSCHEDULE_D2 dryRun:', d2);
}

main().finally(() => prisma.$disconnect());
