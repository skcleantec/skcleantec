import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { resolveScheduleD2SendForInquiry } from '../src/modules/alimtalk/alimtalkScheduleD2.helpers.js';
import { kstTodayYmd } from '../src/modules/inquiries/inquiryListDateRange.js';

async function main() {
  const nums = ['sk2608030007', 'sk2607180008'];
  for (const n of nums) {
    const inv = await prisma.inquiry.findFirst({ where: { inquiryNumber: n }, select: { id: true } });
    if (!inv) continue;
    const r = await resolveScheduleD2SendForInquiry(inv.id);
    console.log(n, 'error' in r ? r.error : { sendYmd: r.sendYmd, today: kstTodayYmd(), match: r.sendYmd === kstTodayYmd() });
  }
}
main().finally(() => prisma.$disconnect());
