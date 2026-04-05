/**
 * 특정 날짜(KST)의 오전 슬롯 접수에 팀장을 순서대로 나눠 배정합니다. (로컬 테스트용)
 *
 * 사용: cd server && npx tsx scripts/reassign-date-morning-leaders.ts
 * 날짜 변경: SEED_REASSIGN_DATE=2026-04-01 npx tsx scripts/reassign-date-morning-leaders.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { consumesMorningSlot } from '../src/modules/schedule/scheduleSlot.helpers.js';

const prisma = new PrismaClient();

const TARGET_DATE = process.env.SEED_REASSIGN_DATE?.trim() || '2026-04-01';

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) throw new Error('관리자 계정이 없습니다.');

  const dayStart = new Date(`${TARGET_DATE}T00:00:00+09:00`);
  const dayEnd = new Date(`${TARGET_DATE}T23:59:59.999+09:00`);

  const leaders = await prisma.user.findMany({
    where: { role: 'TEAM_LEADER', isActive: true },
    select: { id: true, name: true, email: true },
    orderBy: { email: 'asc' },
  });
  if (leaders.length === 0) throw new Error('팀장 계정이 없습니다.');

  const items = await prisma.inquiry.findMany({
    where: {
      preferredDate: { gte: dayStart, lte: dayEnd },
      status: { not: 'CANCELLED' },
    },
    include: {
      assignments: { include: { teamLeader: { select: { name: true } } } },
    },
    orderBy: [{ preferredTime: 'asc' }, { id: 'asc' }],
  });

  const morning = items.filter((i) =>
    consumesMorningSlot({ preferredTime: i.preferredTime, betweenScheduleSlot: i.betweenScheduleSlot })
  );

  console.log(`[${TARGET_DATE}] 전체 ${items.length}건 중 오전 ${morning.length}건 재배정 (팀장 ${leaders.length}명 순환)`);

  for (let idx = 0; idx < morning.length; idx++) {
    const inquiry = morning[idx]!;
    const leader = leaders[idx % leaders.length]!;
    const prev = inquiry.assignments[0]?.teamLeader?.name ?? '(없음)';
    await prisma.$transaction(async (tx) => {
      await tx.assignment.deleteMany({ where: { inquiryId: inquiry.id } });
      await tx.assignment.create({
        data: {
          inquiryId: inquiry.id,
          teamLeaderId: leader.id,
          assignedById: admin.id,
          sortOrder: 0,
        },
      });
    });
    console.log(`  · ${inquiry.customerName} (${inquiry.preferredTime ?? '-'})  ${prev} → ${leader.name}`);
  }

  console.log('완료.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
