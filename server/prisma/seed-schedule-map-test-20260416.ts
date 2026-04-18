/**
 * 2026-04-16 지도·스케줄 테스트 접수 20건 (서울·경기·인천 도로명).
 *
 * 삽입(동일 태그 기존 건 먼저 삭제 후 재삽입):
 *   cd server && npm run db:seed:map:test-20260416
 *   또는 루트: npm run db:seed:map:test-20260416
 *
 * 일괄 삭제만:
 *   cd server && npm run db:purge:map:test-20260416
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import {
  MAP_TEST_20260416_TAG,
  purgeMapTest20260416,
  seedMapTest20260416,
} from '../scripts/schedule-map-test-20260416.logic.js';

const prisma = new PrismaClient();

async function main() {
  const purgeOnly = process.argv.includes('--purge');
  if (purgeOnly) {
    const n = await purgeMapTest20260416(prisma);
    console.log(`삭제 완료: ${n}건 (memo에 "${MAP_TEST_20260416_TAG}" 포함)`);
    return;
  }
  await seedMapTest20260416(prisma);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
