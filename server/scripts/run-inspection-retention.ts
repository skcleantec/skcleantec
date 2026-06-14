/**
 * 완료 검수본 1년(기본) 보관 만료 — Cloudinary·DB 체크리스트 파기
 *
 * Usage:
 *   cd server && npm run cron:inspection-retention
 *   cd server && npm run cron:inspection-retention -- --dry-run
 *
 * Env:
 *   INSPECTION_RETENTION_DAYS=365
 *   INSPECTION_RETENTION_BATCH_SIZE=40
 */
import { prisma } from '../src/lib/prisma.js';
import { connectPrismaWithRetry } from '../src/lib/dbConnectWithRetry.js';
import { purgeExpiredInspectionChecklists } from '../src/modules/inquiry-inspection/inquiryInspection.retention.service.js';

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  await connectPrismaWithRetry(prisma);
  const result = await purgeExpiredInspectionChecklists({ dryRun });
  console.log(JSON.stringify(result, null, 2));
  if (result.errors.length) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
