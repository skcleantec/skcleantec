/**
 * SK클린텍(sk/skcleanteck)·cbiseo.com(cbiseo) 업체 공통 텔레CRM 예시 스크립트 시드.
 * - 카테고리 없음 → 5단계 생성 + 본문
 * - 카테고리만 있고 「기본」탭 본문 비어 있음 → 예시 멘트 채움
 * - 이미 본문이 있는 탭 → 덮어쓰지 않음
 *
 * 실행: cd server && npx tsx scripts/seed-telecrm-default-scripts-priority-tenants.ts
 * (`.env`의 `SKCT_TARGET_DATABASE_URL`이 있으면 운영 DB에도 cbiseo 등 동일 적용)
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { prisma } from '../src/lib/prisma.js';
import {
  applyPriorityTelecrmDefaultSharedScripts,
  type TelecrmDefaultScriptApplyResult,
} from '../src/modules/telecrm/telecrmSeed.service.js';

function logResults(label: string, results: TelecrmDefaultScriptApplyResult[]) {
  console.log(`\n--- ${label} ---`);
  for (const row of results) {
    if (row.skipped) {
      console.log(`[skip] ${row.tenantSlug}: ${row.reason}`);
      continue;
    }
    console.log(
      `[ok] ${row.tenantSlug}: createdCategories=${row.createdCategories}, updatedTabs=${row.updatedTabs}`,
    );
  }
}

async function main() {
  logResults('DATABASE_URL', await applyPriorityTelecrmDefaultSharedScripts(prisma));

  const targetUrl = process.env.SKCT_TARGET_DATABASE_URL?.trim();
  const defaultUrl = process.env.DATABASE_URL?.trim();
  if (targetUrl && targetUrl !== defaultUrl) {
    const targetPrisma = new PrismaClient({ datasources: { db: { url: targetUrl } } });
    try {
      logResults('SKCT_TARGET_DATABASE_URL', await applyPriorityTelecrmDefaultSharedScripts(targetPrisma));
    } finally {
      await targetPrisma.$disconnect();
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
