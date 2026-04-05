/**
 * 1) inquiry_number 중복이 있으면 createdAt이 빠른 한 건만 유지하고 나머지에 새 번호 부여
 * 2) inquiry_number가 비어 있으면 createdAt(KST) 순으로 번호를 채움
 * 3) daily_inquiry_counters를 맞춤
 * 여러 번 실행해도 이미 유일한 번호는 건너뜁니다.
 */
import { prisma } from '../src/lib/prisma.js';
import { formatInquiryNumber, kstYYYYMMDD } from '../src/modules/inquiries/inquiryNumber.js';

/** 기존 접수번호(YYMMDD+4자리)에서 일자별 최대 순번을 perDay에 반영 */
function mergeMaxSeqFromInquiryNumbers(
  perDay: Map<string, number>,
  rows: { inquiryNumber: string | null }[],
): void {
  for (const r of rows) {
    const num = r.inquiryNumber;
    if (!num || num.length !== 10) continue;
    const ymd6 = num.slice(0, 6);
    const dateKey = `20${ymd6}`;
    const seq = parseInt(num.slice(6), 10);
    if (!Number.isFinite(seq)) continue;
    const cur = perDay.get(dateKey) ?? 0;
    if (seq > cur) perDay.set(dateKey, seq);
  }
}

async function main() {
  const counters = await prisma.dailyInquiryCounter.findMany();
  const perDay = new Map<string, number>();
  for (const c of counters) {
    perDay.set(c.dateKey, c.lastSeq);
  }

  const allWithNumber = await prisma.inquiry.findMany({
    where: { inquiryNumber: { not: null } },
    select: { inquiryNumber: true },
  });
  mergeMaxSeqFromInquiryNumbers(perDay, allWithNumber);

  const grouped = await prisma.inquiry.groupBy({
    by: ['inquiryNumber'],
    where: { inquiryNumber: { not: null } },
    _count: { id: true },
  });
  const duplicateNumbers = grouped
    .filter((g) => g.inquiryNumber != null && g._count.id > 1)
    .map((g) => g.inquiryNumber as string);

  let fixedDup = 0;
  for (const num of duplicateNumbers) {
    const rows = await prisma.inquiry.findMany({
      where: { inquiryNumber: num },
      orderBy: { createdAt: 'asc' },
      select: { id: true, createdAt: true },
    });
    const [, ...rest] = rows;
    for (const row of rest) {
      const dk = kstYYYYMMDD(row.createdAt);
      const next = (perDay.get(dk) ?? 0) + 1;
      perDay.set(dk, next);
      const newNum = formatInquiryNumber(dk, next);
      await prisma.inquiry.update({
        where: { id: row.id },
        data: { inquiryNumber: newNum },
      });
      fixedDup++;
    }
  }

  if (fixedDup > 0) {
    console.log(`backfill-inquiry-numbers: 중복 접수번호 ${fixedDup}건 재발급`);
  }

  const pending = await prisma.inquiry.findMany({
    where: { inquiryNumber: null },
    orderBy: { createdAt: 'asc' },
    select: { id: true, createdAt: true },
  });
  if (pending.length === 0 && fixedDup === 0) {
    console.log('backfill-inquiry-numbers: 할 일 없음 (모든 접수에 번호 있음, 중복 없음)');
    await syncCounters(perDay);
    return;
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

  await syncCounters(perDay);

  if (pending.length > 0) {
    console.log(`backfill-inquiry-numbers: null 채움 ${pending.length}건 반영`);
  }
}

async function syncCounters(perDay: Map<string, number>) {
  for (const [dateKey, lastSeq] of perDay) {
    await prisma.dailyInquiryCounter.upsert({
      where: { dateKey },
      create: { dateKey, lastSeq },
      update: { lastSeq },
    });
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
