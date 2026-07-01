import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware, type AuthPayload } from '../auth/auth.middleware.js';
import { requireStaffPermission } from '../auth/marketerPermission.middleware.js';
import { getTenantIdFromAuth } from '../tenants/tenant.middleware.js';
import { createdAtRangeFromQuery, kstDayRangeYmd } from '../inquiries/inquiryListDateRange.js';
import {
  countUnseenPending,
  deleteReviewPaybackRequest,
  parseReviewPaybackStatus,
  ReviewPaybackError,
} from './reviewPayback.service.js';
import { REVIEW_PAYBACK_INCLUDE, serializeReviewPayback } from './reviewPayback.serialize.js';
import { notifyReviewPaybackListRefresh } from './reviewPaybackNotify.js';

const router = Router();
router.use(authMiddleware);
router.use(requireStaffPermission('inquiry.view'));

const DEFAULT_PAGE_SIZE = 30;

async function verifyAdminPasswordForRequest(
  req: import('express').Request,
  res: import('express').Response,
  passwordRaw: unknown,
): Promise<boolean> {
  const password = passwordRaw != null ? String(passwordRaw) : '';
  if (!password) {
    res.status(400).json({ error: '비밀번호를 입력해주세요.' });
    return false;
  }
  const user = (req as unknown as { user: AuthPayload }).user;
  const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
  if (!dbUser) {
    res.status(401).json({ error: '사용자를 찾을 수 없습니다.' });
    return false;
  }
  const valid = await bcrypt.compare(password, dbUser.passwordHash);
  if (!valid) {
    res.status(401).json({ error: '비밀번호가 일치하지 않습니다.' });
    return false;
  }
  return true;
}

function sendPaybackError(res: import('express').Response, e: unknown): void {
  if (res.headersSent) return;
  if (e instanceof ReviewPaybackError) {
    res.status(e.status).json({ error: e.message, code: e.code });
    return;
  }
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P2002') {
      res.status(409).json({ error: '이미 페이백 신청이 완료되었습니다.', code: 'ALREADY_SUBMITTED' });
      return;
    }
    if (e.code === 'P2022') {
      console.error('[review-payback-admin] schema drift P2022:', e.meta);
      res.status(503).json({
        error: 'DB 스키마가 최신이 아닙니다. 잠시 후 다시 시도해 주세요.',
        code: 'SCHEMA_DRIFT',
      });
      return;
    }
  }
  console.error('[review-payback-admin]', e);
  res.status(500).json({ error: '처리 중 오류가 발생했습니다.' });
}

/** 미확인(PENDING·seenAt null) 건수 — 메뉴 배지 */
router.get('/unseen-count', async (req, res) => {
  const tenantId = getTenantIdFromAuth((req as unknown as { user: AuthPayload }).user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const count = await countUnseenPending(tenantId);
  res.json({ count });
});

/** 페이백/리뷰 목록 */
router.get('/', async (req, res) => {
  const tenantId = getTenantIdFromAuth((req as unknown as { user: AuthPayload }).user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const q = req.query as Record<string, string | undefined>;
  const fromYmd = q.from?.trim();
  const toYmd = q.to?.trim();
  const dateRange =
    fromYmd && toYmd
      ? (() => {
          const start = kstDayRangeYmd(fromYmd);
          const end = kstDayRangeYmd(toYmd);
          if (!start || !end) return null;
          return { gte: start.gte, lte: end.lte };
        })()
      : createdAtRangeFromQuery({
          datePreset: q.datePreset,
          month: q.month,
          day: q.day,
        });
  const status = parseReviewPaybackStatus(q.status);
  const unseenOnly = q.unseenOnly === '1' || q.unseenOnly === 'true';
  const page = Math.max(1, parseInt(q.page ?? '1', 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(q.pageSize ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE));
  const search = q.search?.trim();

  const where: Prisma.ReviewPaybackRequestWhereInput = { tenantId };
  if (unseenOnly) {
    where.status = 'PENDING';
    where.seenAt = null;
  } else if (status) {
    where.status = status;
  }
  if (dateRange) {
    where.submittedAt = { gte: dateRange.gte, lte: dateRange.lte };
  }
  if (search) {
    where.OR = [
      { customerName: { contains: search, mode: 'insensitive' } },
      { customerPhone: { contains: search, mode: 'insensitive' } },
      { bankName: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.reviewPaybackRequest.count({ where }),
    prisma.reviewPaybackRequest.findMany({
      where,
      include: REVIEW_PAYBACK_INCLUDE,
      orderBy: { submittedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  res.json({
    items: rows.map((r: (typeof rows)[number]) => serializeReviewPayback(r)),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
});

/** 상세 — 계좌 전체 표시 */
router.get('/:id', async (req, res) => {
  const tenantId = getTenantIdFromAuth((req as unknown as { user: AuthPayload }).user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const row = await prisma.reviewPaybackRequest.findFirst({
    where: { id: req.params.id, tenantId },
    include: REVIEW_PAYBACK_INCLUDE,
  });
  if (!row) {
    res.status(404).json({ error: '신청을 찾을 수 없습니다.' });
    return;
  }
  res.json(serializeReviewPayback(row, { revealAccount: true }));
});

/** 확인 처리 — seenAt 설정 (배지 감소) */
router.post('/:id/seen', async (req, res) => {
  const tenantId = getTenantIdFromAuth((req as unknown as { user: AuthPayload }).user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const updated = await prisma.reviewPaybackRequest.updateMany({
    where: { id: req.params.id, tenantId, seenAt: null },
    data: { seenAt: new Date() },
  });
  if (updated.count > 0) void notifyReviewPaybackListRefresh(tenantId);
  res.json({ ok: true });
});

/** 일괄 확인 — 목록 진입 시 PENDING 미확인 건 */
router.post('/mark-seen-batch', async (req, res) => {
  const tenantId = getTenantIdFromAuth((req as unknown as { user: AuthPayload }).user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const { ids } = req.body as { ids?: string[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ error: 'ids가 필요합니다.' });
    return;
  }
  const updated = await prisma.reviewPaybackRequest.updateMany({
    where: { tenantId, id: { in: ids }, seenAt: null },
    data: { seenAt: new Date() },
  });
  if (updated.count > 0) void notifyReviewPaybackListRefresh(tenantId);
  res.json({ ok: true, updated: updated.count });
});

/** 상태·메모 변경 */
router.patch('/:id', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = getTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const { status: statusRaw, adminMemo } = req.body as { status?: string; adminMemo?: string | null };
  const nextStatus = statusRaw != null ? parseReviewPaybackStatus(statusRaw) : null;
  if (statusRaw != null && !nextStatus) {
    res.status(400).json({ error: '유효하지 않은 상태입니다.' });
    return;
  }
  const existing = await prisma.reviewPaybackRequest.findFirst({
    where: { id: req.params.id, tenantId },
    select: { id: true },
  });
  if (!existing) {
    res.status(404).json({ error: '신청을 찾을 수 없습니다.' });
    return;
  }
  const data: Prisma.ReviewPaybackRequestUpdateInput = {
    handledBy: { connect: { id: user.userId } },
    seenAt: new Date(),
  };
  if (nextStatus) data.status = nextStatus;
  if (adminMemo !== undefined) data.adminMemo = adminMemo?.trim() || null;

  const row = await prisma.reviewPaybackRequest.update({
    where: { id: existing.id },
    data,
    include: REVIEW_PAYBACK_INCLUDE,
  });
  void notifyReviewPaybackListRefresh(tenantId);
  res.json(serializeReviewPayback(row, { revealAccount: true }));
});

/** 비밀번호 확인 후 건별 영구 삭제 */
router.delete('/:id', async (req, res) => {
  const tenantId = getTenantIdFromAuth((req as unknown as { user: AuthPayload }).user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const body = req.body as { password?: string };
  if (!(await verifyAdminPasswordForRequest(req, res, body.password))) return;

  try {
    await deleteReviewPaybackRequest({ tenantId, id: req.params.id });
    void notifyReviewPaybackListRefresh(tenantId);
    res.json({ ok: true });
  } catch (e) {
    sendPaybackError(res, e);
  }
});

export default router;
