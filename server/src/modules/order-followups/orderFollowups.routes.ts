import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { adminOrMarketer } from '../auth/auth.middleware.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { createdAtRangeFromQuery } from '../inquiries/inquiryListDateRange.js';
import {
  appendFollowupLog,
  FOLLOWUP_INCLUDE,
  parseStatus,
  serializeFollowup,
  serializeLog,
} from './orderFollowups.service.js';

const router = Router();
router.use(authMiddleware);
router.use(adminOrMarketer);

function parseNextContact(raw: unknown): Date | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === '') return null;
  if (typeof raw !== 'string') return undefined;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

router.get('/', async (req, res) => {
  const includeFulfilled = req.query.includeFulfilled === '1' || req.query.includeFulfilled === 'true';
  const statusFilter = parseStatus(req.query.status);
  const where: import('@prisma/client').Prisma.OrderFollowupWhereInput = {};
  if (statusFilter) {
    where.status = statusFilter;
  } else if (!includeFulfilled) {
    where.status = { not: 'FULFILLED' };
  }
  const dateRange = createdAtRangeFromQuery({
    datePreset: typeof req.query.datePreset === 'string' ? req.query.datePreset : undefined,
    month: typeof req.query.month === 'string' ? req.query.month : undefined,
    day: typeof req.query.day === 'string' ? req.query.day : undefined,
  });
  if (dateRange) {
    where.createdAt = { gte: dateRange.gte, lte: dateRange.lte };
  }
  const rows = await prisma.orderFollowup.findMany({
    where,
    include: FOLLOWUP_INCLUDE,
    orderBy: [{ createdAt: 'desc' }],
    take: 500,
  });
  res.json({ items: rows.map((r) => serializeFollowup(r)) });
});

router.get('/:id/logs', async (req, res) => {
  const { id } = req.params;
  const exists = await prisma.orderFollowup.findUnique({ where: { id }, select: { id: true } });
  if (!exists) {
    res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
    return;
  }
  const logs = await prisma.orderFollowupLog.findMany({
    where: { followupId: id },
    include: { actor: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  res.json({ items: logs.map(serializeLog) });
});

router.post('/', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const body = req.body as Record<string, unknown>;
  const customerName = typeof body.customerName === 'string' ? body.customerName.trim() : '';
  const customerPhone = typeof body.customerPhone === 'string' ? body.customerPhone.trim() : '';
  if (!customerName) {
    res.status(400).json({ error: '고객명은 필수입니다.' });
    return;
  }
  const status = parseStatus(body.status) ?? 'ABSENT';
  const memo = typeof body.memo === 'string' ? body.memo.trim() || null : null;
  const nextContactAt = parseNextContact(body.nextContactAt);
  const goldDb = typeof body.goldDb === 'boolean' ? body.goldDb : false;
  const row = await prisma.orderFollowup.create({
    data: {
      customerName,
      customerPhone,
      status,
      goldDb,
      memo,
      nextContactAt: nextContactAt === undefined ? null : nextContactAt,
      createdById: user.userId,
      handledById: user.userId,
      depositReceivedAt: status === 'RESERVED' ? new Date() : null,
    },
    include: FOLLOWUP_INCLUDE,
  });
  await appendFollowupLog(prisma, {
    followupId: row.id,
    actorId: user.userId,
    action: 'CREATE',
    detail: JSON.stringify({ status, customerName, customerPhone }),
  });
  const full = await prisma.orderFollowup.findUniqueOrThrow({
    where: { id: row.id },
    include: FOLLOWUP_INCLUDE,
  });
  res.status(201).json({ item: serializeFollowup(full) });
});

router.patch('/:id', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const { id } = req.params;
  const body = req.body as Record<string, unknown>;
  const prev = await prisma.orderFollowup.findUnique({ where: { id } });
  if (!prev) {
    res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
    return;
  }

  const data: import('@prisma/client').Prisma.OrderFollowupUpdateInput = {
    handledBy: { connect: { id: user.userId } },
  };

  if (typeof body.memo === 'string') {
    const m = body.memo.trim();
    data.memo = m || null;
    await appendFollowupLog(prisma, {
      followupId: id,
      actorId: user.userId,
      action: 'MEMO',
      detail: m || null,
    });
  }

  const nc = parseNextContact(body.nextContactAt);
  if (nc !== undefined) {
    data.nextContactAt = nc;
    await appendFollowupLog(prisma, {
      followupId: id,
      actorId: user.userId,
      action: 'NEXT_CONTACT',
      detail: nc ? nc.toISOString() : null,
    });
  }

  const st = parseStatus(body.status);
  if (st) {
    data.status = st;
    if (st === 'RESERVED' && !prev.depositReceivedAt) {
      data.depositReceivedAt = new Date();
    }
    await appendFollowupLog(prisma, {
      followupId: id,
      actorId: user.userId,
      action: 'STATUS',
      detail: JSON.stringify({ from: prev.status, to: st }),
    });
  }

  if (typeof body.goldDb === 'boolean' && body.goldDb !== prev.goldDb) {
    data.goldDb = body.goldDb;
    await appendFollowupLog(prisma, {
      followupId: id,
      actorId: user.userId,
      action: 'GOLD_DB',
      detail: JSON.stringify({ goldDb: body.goldDb }),
    });
  }

  await prisma.orderFollowup.update({
    where: { id },
    data,
  });
  const full = await prisma.orderFollowup.findUniqueOrThrow({
    where: { id },
    include: FOLLOWUP_INCLUDE,
  });
  res.json({ item: serializeFollowup(full) });
});

/** 재연락 후에도 부재·보류 유지 시 보류 횟수 +1 */
router.post('/:id/defer', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const { id } = req.params;
  const body = req.body as { note?: string };
  const prev = await prisma.orderFollowup.findUnique({ where: { id } });
  if (!prev) {
    res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
    return;
  }
  if (prev.status === 'FULFILLED') {
    res.status(400).json({ error: '처리 완료된 건에는 부재 누적을 할 수 없습니다.' });
    return;
  }
  const note = typeof body.note === 'string' ? body.note.trim() : '';
  await prisma.orderFollowup.update({
    where: { id },
    data: {
      deferCount: { increment: 1 },
      handledBy: { connect: { id: user.userId } },
    },
  });
  await appendFollowupLog(prisma, {
    followupId: id,
    actorId: user.userId,
    action: 'DEFER',
    detail: JSON.stringify({ deferCount: prev.deferCount + 1, note: note || undefined }),
  });
  const full = await prisma.orderFollowup.findUniqueOrThrow({
    where: { id },
    include: FOLLOWUP_INCLUDE,
  });
  res.json({ item: serializeFollowup(full) });
});

export default router;
