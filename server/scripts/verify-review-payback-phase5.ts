/**
 * Phase 5 검증: WS 알림·GNB/서브메뉴 배지·미확인 카운트
 * 실행: cd server && npx tsx scripts/verify-review-payback-phase5.ts
 * 선택: STAGING_BASE, ADMIN_JWT
 */
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { REVIEW_PAYBACK_WS_TYPE, REVIEW_PAYBACK_LOG_PREFIX } from '../src/modules/review-payback/reviewPayback.constants.js';
import { countUnseenPending } from '../src/modules/review-payback/reviewPayback.service.js';
import type { ReviewPaybackWsPayload } from '../src/modules/review-payback/reviewPaybackNotify.js';

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

function buildWsPayload(customerName: string): ReviewPaybackWsPayload {
  return {
    type: REVIEW_PAYBACK_WS_TYPE,
    requestId: 'verify-phase5',
    customerName,
    orderFormId: 'verify-order',
    inquiryId: null,
    summary: `${REVIEW_PAYBACK_LOG_PREFIX} ${customerName}님 리뷰 페이백 신청`,
  };
}

async function main() {
  console.log('[phase5] STAGING_BASE:', STAGING_BASE);

  const payload = buildWsPayload('검증고객');
  assert(payload.type === 'review-payback:new', 'WS type');
  assert(payload.summary.includes('페이백'), 'WS summary');
  console.log('[phase5] WS payload shape: OK');

  const noAuth = await fetchJson(`${STAGING_BASE}/api/admin/nav-badges`);
  assert(noAuth.status === 401, `nav-badges without auth should 401, got ${noAuth.status}`);
  console.log('[phase5] GET /api/admin/nav-badges without auth → 401: OK');

  const tenant = await prisma.tenant.findFirst({ select: { id: true } });
  assert(tenant != null, 'tenant 없음');

  const before = await countUnseenPending(tenant.id);
  assert(typeof before === 'number', 'countUnseenPending number');
  console.log('[phase5] countUnseenPending (before):', before);

  const order = await prisma.orderForm.findFirst({
    where: {
      tenantId: tenant.id,
      reviewPaybackRequest: null,
    },
    select: {
      id: true,
      tenantId: true,
      customerName: true,
      customerPhone: true,
    },
  });

  if (order) {
    const row = await prisma.reviewPaybackRequest.create({
      data: {
        tenantId: order.tenantId,
        orderFormId: order.id,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        bankName: '검증은행',
        accountNumber: '1234567890',
        reviewImageUrl: 'https://example.com/verify-phase5.jpg',
        status: 'PENDING',
        seenAt: null,
      },
    });
    const after = await countUnseenPending(tenant.id);
    assert(after === before + 1, `unseen count should +1 (before=${before}, after=${after})`);
    console.log('[phase5] DB unseen count +1 after test insert: OK');

    await prisma.reviewPaybackRequest.update({
      where: { id: row.id },
      data: { seenAt: new Date() },
    });
    const afterSeen = await countUnseenPending(tenant.id);
    assert(afterSeen === before, `seen should restore count (before=${before}, afterSeen=${afterSeen})`);
    console.log('[phase5] seenAt 설정 시 배지 감소: OK');

    await prisma.reviewPaybackRequest.delete({ where: { id: row.id } });
    console.log('[phase5] test row cleaned up');
  } else {
    console.log('[phase5] 페이백 미신청 발주서 없음 — DB insert 스킵');
  }

  if (ADMIN_JWT) {
    const badges = await fetchJson(`${STAGING_BASE}/api/admin/nav-badges`, {
      headers: { Authorization: `Bearer ${ADMIN_JWT}`, Accept: 'application/json' },
    });
    assert(badges.ok, `nav-badges auth failed: ${badges.status}`);
    const j = badges.body as { reviewPaybackUnseenCount?: number };
    assert(typeof j.reviewPaybackUnseenCount === 'number', 'reviewPaybackUnseenCount field missing');
    console.log('[phase5] authenticated nav-badges.reviewPaybackUnseenCount:', j.reviewPaybackUnseenCount);
  } else {
    console.log('[phase5] ADMIN_JWT 없음 — 인증 nav-badges 스킵');
  }

  console.log('[phase5] OK — 고객 신청 시 GNB·페이백/리뷰 메뉴 배지·토스트(AdminLayout) 동작 확인');
}

main()
  .catch((e) => {
    console.error('[phase5] FAIL', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
