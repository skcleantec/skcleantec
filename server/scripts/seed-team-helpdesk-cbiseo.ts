/**
 * 팀장 cbiseo 도움말용 데모 데이터 — SK클린텍(sk)
 * 실행: cd server && npx tsx scripts/seed-team-helpdesk-cbiseo.ts
 */
import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { runTeamHelpdeskCbiseoSeed } from './seed-team-helpdesk-cbiseo.logic.js';

async function main() {
  const password = process.env.SEED_CBiseo_PASSWORD?.trim() || '1234';
  const result = await runTeamHelpdeskCbiseoSeed(prisma, { password });
  console.log('【팀장 도움말 시드 완료】');
  console.log(`  업체: SK클린텍 (slug: sk)`);
  console.log(`  팀장 로그인: cbiseo / 비밀번호: ${password === '1234' ? '1234 (기본)' : '(SEED_CBiseo_PASSWORD)'}`);
  console.log(`  기존 시드 삭제: ${result.purged}건`);
  console.log(`  접수 생성: ${result.inquiryCount}건 (memo 태그: [팀장도움말 cbiseo])`);
  console.log('  시나리오: 오늘/내일/완료/보류/취소/C/S/타업체/검수/해피콜/미팅시각/변경이력 등');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
