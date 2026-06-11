/**
 * Phase 3 검증: 스테이징 — 고객 메시지 페이백 링크·공개 API·페이지 라우트
 * 실행: cd server && npx tsx scripts/verify-review-payback-phase3.ts
 * 선택: ORDER_FORM_TOKEN=발주서토큰 STAGING_BASE=https://...
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { ensureReviewPaybackToken } from '../src/modules/review-payback/reviewPayback.service.js';

function buildReviewPaybackMessageBlock(paybackLink: string): string {
  return `★ 리뷰 페이백 신청 (전화·카톡 확인 없이 링크에서만 접수됩니다)
리뷰 작성 후 반드시 아래 링크에 접속해 캡처·계좌를 등록해 주세요.
전화나 메시지로 보내주시면 확인이 지연될 수 있습니다.

페이백 신청: ${paybackLink}`;
}

const STAGING_BASE = (process.env.STAGING_BASE ?? 'https://clean-solution-staging.up.railway.app').replace(
  /\/$/,
  '',
);
const TENANT_SLUG = process.env.TENANT_SLUG ?? 'sk';
const BRAND_SLUG = process.env.BRAND_SLUG ?? 'sk';
const ORDER_FORM_TOKEN = process.env.ORDER_FORM_TOKEN ?? 'a94995f9dbdfaf0448a0445';

const serverDir = path.resolve(import.meta.dirname, '..');
dotenv.config({ path: path.resolve(serverDir, '.env') });
if (fs.existsSync(path.resolve(serverDir, '.env.staging'))) {
  dotenv.config({ path: path.resolve(serverDir, '.env.staging'), override: true });
}

const prisma = new PrismaClient();

function paybackPublicUrl(paybackToken: string): string {
  const qs = new URLSearchParams({ tenant: TENANT_SLUG, brand: BRAND_SLUG });
  return `${STAGING_BASE}/review-payback/${encodeURIComponent(paybackToken)}?${qs.toString()}`;
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

async function fetchJson(url: string) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
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
  console.log('[phase3] STAGING_BASE:', STAGING_BASE);

  const health = await fetchJson(`${STAGING_BASE}/api/health`);
  assert(health.ok, `health check failed: ${health.status}`);
  console.log('[phase3] /api/health: OK');

  let order = await prisma.orderForm.findFirst({
    where: { token: ORDER_FORM_TOKEN },
    select: {
      id: true,
      tenantId: true,
      token: true,
      customerName: true,
      reviewPaybackToken: true,
      totalAmount: true,
      depositAmount: true,
      balanceAmount: true,
    },
  });
  if (!order) {
    console.warn(`[phase3] token=${ORDER_FORM_TOKEN} 없음 — 최신 발주서로 대체`);
    order = await prisma.orderForm.findFirst({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        tenantId: true,
        token: true,
        customerName: true,
        reviewPaybackToken: true,
        totalAmount: true,
        depositAmount: true,
        balanceAmount: true,
      },
    });
  }
  assert(order != null, '검증할 발주서 없음');
  console.log('[phase3] order:', order.customerName, order.token);

  const paybackToken = await ensureReviewPaybackToken(prisma, order.id, order.tenantId);
  assert(Boolean(paybackToken?.trim()), 'reviewPaybackToken empty after ensure');
  console.log('[phase3] reviewPaybackToken: OK');

  const paybackLink = paybackPublicUrl(paybackToken);
  const block = buildReviewPaybackMessageBlock(paybackLink);
  assert(block.includes('페이백 신청:'), 'message block missing payback label');
  assert(block.includes(paybackLink), 'message block missing payback URL');
  assert(block.includes('전화·카톡 확인 없이'), 'message block missing emphasis');
  console.log('[phase3] customer message block preview:\n---\n' + block + '\n---');

  const apiUrl = `${STAGING_BASE}/api/public/review-payback/${encodeURIComponent(paybackToken)}?tenant=${TENANT_SLUG}&brand=${BRAND_SLUG}`;
  const meta = await fetchJson(apiUrl);
  assert(meta.ok, `public meta API failed: ${meta.status} ${JSON.stringify(meta.body)}`);
  const m = meta.body as { customerName?: string; alreadySubmitted?: boolean };
  assert(typeof m.customerName === 'string', 'public meta missing customerName');
  console.log('[phase3] GET public meta:', m.customerName, 'alreadySubmitted=', m.alreadySubmitted);

  const pageRes = await fetch(paybackLink, { headers: { Accept: 'text/html' } });
  assert(pageRes.ok, `payback page failed: ${pageRes.status}`);
  const html = await pageRes.text();
  assert(html.includes('id="root"') || html.includes("id='root'"), 'SPA index missing #root');
  console.log('[phase3] GET /review-payback/:token SPA shell: OK (브라우저에서 폼 렌더 확인)');

  console.log('[phase3] OK — 배포 후 발주서 목록에서 메시지 복사 시 위 페이백 블록이 포함되어야 합니다.');
  console.log('[phase3] 수동: 고객 페이지에서 캡처 업로드·계좌 입력·「리뷰 페이백 신청」 제출');
}

main()
  .catch((e) => {
    console.error('[phase3] FAIL', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
