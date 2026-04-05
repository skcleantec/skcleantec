/**
 * 이번 달 미분배(RECEIVED, 팀장 미배정) 테스트 데이터 — 대시보드「이번달 미분배」집계용.
 *
 * cd server && npm run db:seed:unassigned-month
 *
 * 삭제만: npm run db:purge:unassigned-month-test
 *
 * 환경변수: SEED_COUNT (기본 20), SEED_MONTH (YYYY-MM, 기본 이번 달 KST)
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import {
  runUnassignedMonthDashboardSeed,
  purgeUnassignedMonthTest,
  tagUnassignedMonthTest,
} from '../scripts/seed-unassigned-month-dashboard.logic.js';
import { kstTodayYmd } from '../src/modules/inquiries/inquiryListDateRange.js';

const prisma = new PrismaClient();

async function main() {
  const purgeOnly = process.argv.includes('--purge');
  const monthKey =
    typeof process.env.SEED_MONTH === 'string' && /^\d{4}-\d{2}$/.test(process.env.SEED_MONTH.trim())
      ? process.env.SEED_MONTH.trim()
      : kstTodayYmd().slice(0, 7);
  const count = Math.max(1, Number(process.env.SEED_COUNT) || 20);

  if (purgeOnly) {
    const n = await purgeUnassignedMonthTest(prisma, monthKey);
    console.log(`삭제: ${n}건 (memo에 "${tagUnassignedMonthTest(monthKey)}" 포함)`);
    return;
  }

  await runUnassignedMonthDashboardSeed(prisma, { count, monthKey });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
