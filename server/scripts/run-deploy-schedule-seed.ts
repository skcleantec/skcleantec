/**
 * Railway preDeploy 등에서 호출: server/deploy-seed.config.json 을 읽어
 * 활성화된 시드만 실행합니다.
 *
 * - marMayScheduleTest: 3·4·5월 랜덤 + 팀장 배정
 * - unassignedMonthDashboardTest: 이번 달 KST · RECEIVED · 팀장 미배정 (대시보드 미분배 집계)
 *
 * 로컬: cd server && npm run deploy:seed-from-config
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';
import { runMarMayScheduleSeed } from './schedule-mar-may-seed.logic.js';
import { runUnassignedMonthDashboardSeed } from './seed-unassigned-month-dashboard.logic.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, '../deploy-seed.config.json');

type DeploySeedConfig = {
  marMayScheduleTest?: {
    enabled?: boolean;
    year?: number;
    count?: number;
  };
  unassignedMonthDashboardTest?: {
    enabled?: boolean;
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

  const prisma = new PrismaClient();
  try {
    let ran = false;

    const m = cfg.marMayScheduleTest;
    if (m?.enabled) {
      ran = true;
      const year = Number(m.year) || new Date().getFullYear();
      const count = Math.max(1, Number(m.count) || 90);
      console.log(`[deploy-seed] marMayScheduleTest 실행 (year=${year}, count=${count})`);
      await runMarMayScheduleSeed(prisma, { year, count });
    }

    const u = cfg.unassignedMonthDashboardTest;
    if (u?.enabled) {
      ran = true;
      const count = Math.max(1, Number(u.count) || 20);
      console.log(`[deploy-seed] unassignedMonthDashboardTest 실행 (count=${count})`);
      await runUnassignedMonthDashboardSeed(prisma, { count });
    }

    if (!ran) {
      console.log('[deploy-seed] 활성화된 시드 없음 → 건너뜀');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
