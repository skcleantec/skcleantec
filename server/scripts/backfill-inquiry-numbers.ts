/**
 * 기존 접수에 inquiry_number가 비어 있으면 createdAt(KST) 순으로 번호를 채우고
 * daily_inquiry_counters를 맞춥니다. 여러 번 실행해도 이미 번호가 있는 행은 건너뜁니다.
 */
import { prisma } from '../src/lib/prisma.js';
import { formatInquiryNumber, kstYYYYMMDD } from '../src/modules/inquiries/inquiryNumber.js';

async function main() {
  const pending = await prisma.inquiry.findMany({
    where: { inquiryNumber: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true, createdAt: true },
  });
  if (pending.length === 0) {
    console.log('backfill-inquiry-numbers: 할 일 없음 (모든 접수에 번호 있음)');
    return;
  }

  const counters = await prisma.dailyInquiryCounter.findMany();
  const perDay = new Map<string, number>();
  for (const c of counters) {
    perDay.set(c.dateKey, c.lastSeq);
  }

  for (const row of pending) {
    const dk = kstYYYYMMDD(row.createdAt);
    const next = (perDay.get(dk) ?? 0) + 1;
    perDay.set(dk, next);
    const num = formatInquiryNumber(dk, next);
    await prisma.inquiry.update({
      where: { id: row.id },
      data: { inquiryNumber: num },
    });
  }

  for (const [dateKey, lastSeq] of perDay) {
    await prisma.dailyInquiryCounter.upsert({
      where: { dateKey },
      create: { dateKey, lastSeq },
      update: { lastSeq },
    });
  }

  console.log(`backfill-inquiry-numbers: ${pending.length}건 반영`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
