/**
 * 배포본 → 초안 불러오기 검증
 * 실행: cd server && npx tsx scripts/verify-e-contract-draft-clone.ts
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient, EContractVersionStatus } from '@prisma/client';
import { clonePublishedToDraft } from '../src/modules/e-contract/eContract.service.js';

const serverDir = path.resolve(import.meta.dirname, '..');
dotenv.config({ path: path.resolve(serverDir, '.env') });
if (fs.existsSync(path.resolve(serverDir, '.env.staging'))) {
  dotenv.config({ path: path.resolve(serverDir, '.env.staging'), override: true });
}

const prisma = new PrismaClient();

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const tenant = await prisma.tenant.findFirst({ select: { id: true } });
  assert(tenant != null, 'tenant 없음');

  const published = await prisma.eContractVersion.findFirst({
    where: {
      status: EContractVersionStatus.PUBLISHED,
      definition: { tenantId: tenant.id },
      bodyMarkdown: { not: '' },
    },
    orderBy: { publishedAt: 'desc' },
    select: { id: true, definitionId: true, titleSnapshot: true, bodyMarkdown: true, publishedOrdinal: true },
  });
  if (!published) {
    console.log('[draft-clone] 배포본(본문 있음) 없음 — 스킵');
    return;
  }

  const beforeDraft = await prisma.eContractVersion.findFirst({
    where: { definitionId: published.definitionId, status: EContractVersionStatus.DRAFT },
  });
  if (beforeDraft) {
    await prisma.eContractVersion.delete({ where: { id: beforeDraft.id } });
    console.log('[draft-clone] 기존 초안 삭제 후 테스트');
  }

  const result = await clonePublishedToDraft(tenant.id, published.definitionId, published.id);
  assert(result.draft.status === EContractVersionStatus.DRAFT, 'draft status');
  assert(result.draft.titleSnapshot === published.titleSnapshot.trim(), 'title copied');
  assert(result.draft.bodyMarkdown.includes(published.bodyMarkdown!.slice(0, 32)), 'body copied');
  assert(result.clonedFrom.id === published.id, 'clonedFrom id');
  assert(result.clonedFrom.publishedOrdinal === published.publishedOrdinal, 'clonedFrom ordinal');

  const overwrite = await clonePublishedToDraft(tenant.id, published.definitionId, published.id);
  assert(overwrite.draft.id === result.draft.id, 'same draft row overwritten');

  console.log('[draft-clone] clonePublishedToDraft: OK');
}

main()
  .catch((e) => {
    console.error('[draft-clone] FAIL:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
