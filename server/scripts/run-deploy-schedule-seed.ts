/**
 * Railway preDeploy 등에서 호출: server/deploy-seed.config.json 을 읽어
 * marMayScheduleTest.enabled 가 true 일 때만 3·4·5월 테스트 시드를 실행합니다.
 *
 * 운영에 넣고 싶을 때: JSON 에서 enabled 를 true 로 커밋·푸시 → 배포 한 번 돌면 preDeploy 에서 실행.
 * 끝나면 반드시 enabled 를 false 로 되돌려 커밋하세요(매 배포마다 동일 태그 건 삭제 후 재삽입됨).
 *
 * 로컬 확인: cd server && npm run deploy:seed-from-config
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { runMarMayScheduleSeed } from './schedule-mar-may-seed.logic.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, '../deploy-seed.config.json');

type DeploySeedConfig = {
  marMayScheduleTest?: {
    enabled?: boolean;
    year?: number;
    count?: number;
  };
};

async function main() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.log('[deploy-seed] deploy-seed.config.json 없음 → 건너뜀');
    return;
  }

  let cfg: DeploySeedConfig;
  try {
    cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) as DeploySeedConfig;
  } catch (e) {
    console.error('[deploy-seed] JSON 파싱 실패:', e);
    process.exit(1);
  }

  const m = cfg.marMayScheduleTest;
  if (!m?.enabled) {
    console.log('[deploy-seed] marMayScheduleTest.enabled 가 아님 → 건너뜀');
    return;
  }

  const year = Number(m.year) || new Date().getFullYear();
  const count = Math.max(1, Number(m.count) || 90);

  console.log(`[deploy-seed] marMayScheduleTest 실행 (year=${year}, count=${count})`);

  const prisma = new PrismaClient();
  try {
    await runMarMayScheduleSeed(prisma, { year, count });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
