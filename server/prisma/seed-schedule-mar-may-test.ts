/**
 * 3·4·5월 범위 랜덤 스케줄 테스트 데이터(접수 + 팀장 배정).
 * 메모에 고정 태그를 넣어 Prisma Studio·스크립트로 일괄 삭제 가능합니다.
 *
 * 삽입(같은 태그로 만든 기존 건은 먼저 삭제 후 재삽입):
 *   cd server && npm run db:seed:schedule:test-m3-m5
 *
 * 일괄 삭제만:
 *   cd server && npm run db:purge:schedule:test-m3-m5
 *
 * 배포 시 JSON 으로 실행: server/deploy-seed.config.json + preDeploy (deploy:seed-from-config)
 *
 * 환경변수(선택):
 *   SEED_YEAR — 기본: 올해(예: 2026)
 *   SEED_COUNT — 기본: 90 (3개월에 걸쳐 랜덤 분포)
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import {
  runMarMayScheduleSeed,
  purgeMarMayTestByYear,
  tagForYear,
} from '../scripts/schedule-mar-may-seed.logic.js';

const prisma = new PrismaClient();

async function main() {
  const purgeOnly = process.argv.includes('--purge');
  const year = Number(process.env.SEED_YEAR) || new Date().getFullYear();
  const count = Math.max(1, Number(process.env.SEED_COUNT) || 90);

  if (purgeOnly) {
    const n = await purgeMarMayTestByYear(prisma, year);
    console.log(`삭제 완료: ${n}건 (memo에 "${tagForYear(year)}" 포함)`);
    return;
  }

  await runMarMayScheduleSeed(prisma, { year, count });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
