import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { happyCallCronPreferredDateRange } from '../src/modules/inquiries/happyCall.helpers.js';

const SCI = '5816a2cc-9b35-4deb-976f-c3494b266f6f';
const SK = 'a0000000-0000-4000-8000-000000000001';
const now = new Date();

async function main() {
  const range = happyCallCronPreferredDateRange(now);
  console.log('cron range:', range);

  const ids = ['d663c728-793a-42a0-9850-82ee09c26887'];
  const byNum = await prisma.inquiry.findMany({
    where: { tenantId: SK, inquiryNumber: { in: ['tn2608150002'] } },
    select: { id: true, inquiryNumber: true, preferredDate: true, status: true, happyCallCompletedAt: true, customerName: true },
  });
  for (const id of [...ids, ...byNum.map((x) => x.id)]) {
    const inv = await prisma.inquiry.findFirst({
      where: { tenantId: SK, id },
      select: {
        inquiryNumber: true,
        customerName: true,
        preferredDate: true,
        status: true,
        happyCallCompletedAt: true,
        assignments: { select: { teamLeader: { select: { name: true } } } },
      },
    });
    if (!inv) continue;
    const pd = inv.preferredDate;
    const inRange =
      pd && range ? pd >= range.gte && pd <= range.lte : false;
    console.log('\n---', inv.inquiryNumber, '---');
    console.log({
      customer: inv.customerName,
      status: inv.status,
      preferredDateKst: pd?.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10),
      happyCallDone: inv.happyCallCompletedAt,
      inCronRange: inRange,
      teamLeader: inv.assignments[0]?.teamLeader?.name,
    });
  }

  const allSciPending = await prisma.assignment.count({
    where: {
      tenantId: SK,
      teamLeaderId: SCI,
      inquiry: { happyCallCompletedAt: null, preferredDate: { not: null }, status: 'RECEIVED' },
    },
  });
  console.log('\n서청일 RECEIVED 미완 해피콜 count:', allSciPending);

  const inRangeCount = await prisma.assignment.count({
    where: {
      tenantId: SK,
      inquiry: {
        happyCallCompletedAt: null,
        preferredDate: range ? { gte: range.gte, lte: range.lte } : undefined,
        status: { notIn: ['CANCELLED', 'ON_HOLD', 'PENDING', 'DEPOSIT_PENDING', 'DEPOSIT_COMPLETED', 'ORDER_FORM_PENDING'] },
      },
    },
  });
  console.log('SK entire tenant in-range pending HC:', inRangeCount);

  const lastCronLogs = await prisma.notificationDeliveryLog.findMany({
    where: { tenantId: SK, kind: 'happy_call' },
    orderBy: { sentAt: 'desc' },
    take: 3,
    select: { sentAt: true, userId: true, dedupeKey: true },
  });
  console.log('\nLast SK happy_call logs:', lastCronLogs);
}

main().finally(() => prisma.$disconnect());
