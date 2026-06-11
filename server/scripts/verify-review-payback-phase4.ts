/**
 * Phase 4 검증: 관리자 페이백/리뷰 — API·SPA 라우트·목록 직렬화
 * 실행: cd server && npx tsx scripts/verify-review-payback-phase4.ts
 * 선택: STAGING_BASE, ADMIN_JWT (스태프 JWT — 있으면 목록 API까지 검증)
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { serializeReviewPayback, REVIEW_PAYBACK_INCLUDE } from '../src/modules/review-payback/reviewPayback.serialize.js';
import { countUnseenPending } from '../src/modules/review-payback/reviewPayback.service.js';
import { maskAccountNumber } from '../src/modules/review-payback/reviewPayback.mask.js';

const STAGING_BASE = (process.env.STAGING_BASE ?? 'https://clean-solution-staging.up.railway.app').replace(
  /\/$/,
  '',
);
const ADMIN_JWT = process.env.ADMIN_JWT?.trim();

const serverDir = path.resolve(import.meta.dirname, '..');
dotenv.config({ path: path.resolve(serverDir, '.env') });
if (fs.existsSync(path.resolve(serverDir, '.env.staging'))) {
  dotenv.config({ path: path.resolve(serverDir, '.env.staging'), override: true });
}

const prisma = new PrismaClient();

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  const text = await res.text();
  let body: unknown = null;
  try {
    body = JSON.parse(text);
  } catch {
    body = text.slice(0, 200);
  }
  return { ok: res.ok, status: res.status, body };
}

async function main() {
  console.log('[phase4] STAGING_BASE:', STAGING_BASE);

  const health = await fetchJson(`${STAGING_BASE}/api/health`);
  assert(health.ok, `health check failed: ${health.status}`);
  console.log('[phase4] /api/health: OK');

  const noAuth = await fetchJson(`${STAGING_BASE}/api/review-paybacks`);
  assert(noAuth.status === 401, `list without auth should 401, got ${noAuth.status}`);
  console.log('[phase4] GET /api/review-paybacks without auth → 401: OK');

  const unseenNoAuth = await fetchJson(`${STAGING_BASE}/api/review-paybacks/unseen-count`);
  assert(unseenNoAuth.status === 401, `unseen-count without auth should 401, got ${unseenNoAuth.status}`);
  console.log('[phase4] GET /api/review-paybacks/unseen-count without auth → 401: OK');

  const adminPage = await fetch(`${STAGING_BASE}/admin/inquiries/review-payback`, {
    headers: { Accept: 'text/html' },
  });
  assert(adminPage.ok, `admin SPA route failed: ${adminPage.status}`);
  const html = await adminPage.text();
  assert(html.includes('id="root"') || html.includes("id='root'"), 'admin page missing #root');
  console.log('[phase4] GET /admin/inquiries/review-payback SPA shell: OK');

  const tenant = await prisma.tenant.findFirst({ select: { id: true, slug: true } });
  assert(tenant != null, 'tenant 없음');
  const unseen = await countUnseenPending(tenant.id);
  assert(typeof unseen === 'number', 'countUnseenPending must return number');
  console.log('[phase4] countUnseenPending:', unseen);

  const sample = await prisma.reviewPaybackRequest.findFirst({
    where: { tenantId: tenant.id },
    include: REVIEW_PAYBACK_INCLUDE,
    orderBy: { submittedAt: 'desc' },
  });
  if (sample) {
    const masked = serializeReviewPayback(sample);
    const revealed = serializeReviewPayback(sample, { revealAccount: true });
    assert(masked.accountNumber !== sample.accountNumber, 'list must mask account');
    assert(revealed.accountNumber === sample.accountNumber, 'detail must reveal account');
    assert(masked.accountNumberMasked === maskAccountNumber(sample.accountNumber), 'masked field');
    console.log('[phase4] serialize mask/reveal:', sample.customerName, sample.status);
  } else {
    console.log('[phase4] DB에 ReviewPaybackRequest 없음 — 직렬화 스킵(고객 신청 후 재검증)');
  }

  if (ADMIN_JWT) {
    const list = await fetchJson(`${STAGING_BASE}/api/review-paybacks?page=1&pageSize=5`, {
      headers: { Authorization: `Bearer ${ADMIN_JWT}`, Accept: 'application/json' },
    });
    assert(list.ok, `authenticated list failed: ${list.status} ${JSON.stringify(list.body)}`);
    const j = list.body as { items?: unknown[]; total?: number };
    assert(Array.isArray(j.items), 'list items must be array');
    assert(typeof j.total === 'number', 'list total must be number');
    console.log('[phase4] authenticated list:', j.total, '건');

    const badge = await fetchJson(`${STAGING_BASE}/api/review-paybacks/unseen-count`, {
      headers: { Authorization: `Bearer ${ADMIN_JWT}`, Accept: 'application/json' },
    });
    assert(badge.ok, `unseen-count auth failed: ${badge.status}`);
    console.log('[phase4] authenticated unseen-count:', (badge.body as { count?: number }).count);
  } else {
    console.log('[phase4] ADMIN_JWT 없음 — 인증 목록 API 스킵 (브라우저 로그인 후 /admin/inquiries/review-payback 수동 확인)');
  }

  console.log('[phase4] OK — 관리자 메뉴 「페이백/리뷰」에서 목록·상세·상태 변경·접수/발주서 링크 확인');
}

main()
  .catch((e) => {
    console.error('[phase4] FAIL', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
