/**
 * SK 테넌트 admin 표시명 복구 — 이정무대표
 * 실행: cd server && npx tsx scripts/restore-sk-admin-display-name.ts
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const dir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(dir, '../.env') });

const SK_TENANT_ID = 'a0000000-0000-4000-8000-000000000001';
const RESTORE_NAME = '이정무대표';

async function main() {
  const url = process.env.SKCT_TARGET_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL missing');
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const before = await prisma.user.findUnique({
      where: { tenantId_email: { tenantId: SK_TENANT_ID, email: 'admin' } },
      select: { id: true, email: true, name: true, role: true },
    });
    if (!before) {
      console.error('admin user not found for sk tenant');
      process.exit(1);
    }
    console.log('before:', before);

    const updated = await prisma.user.update({
      where: { id: before.id },
      data: { name: RESTORE_NAME },
      select: { id: true, email: true, name: true, role: true },
    });
    console.log('after:', updated);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
