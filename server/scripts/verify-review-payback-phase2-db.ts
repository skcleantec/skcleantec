/**
 * Phase 2 검증: 스테이징 DB에 페이백 스키마·토큰 컬럼 존재 확인
 * 실행: cd server && npx tsx scripts/verify-review-payback-phase2-db.ts
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

const serverDir = path.resolve(import.meta.dirname, '..');
dotenv.config({ path: path.resolve(serverDir, '.env') });
if (fs.existsSync(path.resolve(serverDir, '.env.staging'))) {
  dotenv.config({ path: path.resolve(serverDir, '.env.staging'), override: true });
}

const prisma = new PrismaClient();

async function main() {
  const host = (process.env.DATABASE_URL ?? '').includes('proxy.rlwy.net') ? 'staging-proxy' : 'other';
  console.log('[phase2-db] DATABASE_URL target:', host);

  const cols = await prisma.$queryRaw<{ column_name: string }[]>`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'order_forms' AND column_name = 'review_payback_token'
  `;
  const tbl = await prisma.$queryRaw<{ table_name: string }[]>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'review_payback_requests'
  `;

  const [withToken, total] = await Promise.all([
    prisma.orderForm.count({ where: { reviewPaybackToken: { not: null } } }),
    prisma.orderForm.count(),
  ]);

  if (cols.length === 0) throw new Error('order_forms.review_payback_token column MISSING');
  if (tbl.length === 0) throw new Error('review_payback_requests table MISSING');

  console.log('[phase2-db] review_payback_token column: OK');
  console.log('[phase2-db] review_payback_requests table: OK');
  console.log(`[phase2-db] order_forms with payback token: ${withToken} / ${total}`);
  console.log('[phase2-db] OK');
}

main()
  .catch((e) => {
    console.error('[phase2-db] FAIL', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
