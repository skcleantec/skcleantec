/**
 * 정보공유(DB 마켓) 스테이징·QA 테스트 데이터
 *
 * 삽입(재실행 시 동일 태그 건 삭제 후 재생성):
 *   cd server && npm run db:seed:db-marketplace-test
 *
 * 삭제만:
 *   cd server && npm run db:purge:db-marketplace-test
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import {
  DB_MARKETPLACE_TEST_TAG,
  purgeDbMarketplaceTest,
  runDbMarketplaceTestSeed,
} from '../scripts/seed-db-marketplace-test.logic.js';

const prisma = new PrismaClient();

async function main() {
  const purgeOnly = process.argv.includes('--purge');
  if (purgeOnly) {
    const n = await purgeDbMarketplaceTest(prisma);
    console.log(`삭제 완료: ${n}건 (memo "${DB_MARKETPLACE_TEST_TAG}")`);
    return;
  }
  await runDbMarketplaceTestSeed(prisma);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
