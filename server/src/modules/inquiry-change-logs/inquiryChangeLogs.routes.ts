import { Router } from 'express';
import bcrypt from 'bcryptjs';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { superAdminOnly } from '../auth/auth.middleware.js';
import { requireStaffPermission } from '../auth/marketerPermission.middleware.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { requireTenantIdFromAuth } from '../tenants/tenantScope.helpers.js';
import {
  toChangeHistoryItemDto,
} from './inquiryChangeLogs.helpers.js';

const router = Router();

router.use(authMiddleware);
router.use(requireStaffPermission('inquiry.changeLog.view'));

const logInclude = {
  inquiry: { select: { customerName: true } },
} as const;

function tenantChangeLogWhere(tenantId: string): Prisma.InquiryChangeLogWhereInput {
  return {
    OR: [
      { inquiry: { tenantId } },
      { inquiryId: null, actor: { tenantId } },
    ],
  };
}

async function attachActorNames<T extends { actorId: string | null }>(
  rows: T[]
): Promise<Map<string, string>> {
  const ids = [...new Set(rows.map((r) => r.actorId).filter(Boolean))] as string[];
  if (ids.length === 0) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  });
  return new Map(users.map((u) => [u.id, u.name]));
}

/** 미확인 변경 이력 수 (마지막 확인 시각 이후 생성분) — 알림 종 아이콘용 */
router.get('/unseen-count', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;

  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { changeLogSeenAt: true },
  });
  const seenAt = dbUser?.changeLogSeenAt ?? null;

  const where: Prisma.InquiryChangeLogWhereInput = {
    AND: [
      tenantChangeLogWhere(tenantId),
      seenAt ? { createdAt: { gt: seenAt } } : {},
    ],
  };
  const [count, latest] = await Promise.all([
    prisma.inquiryChangeLog.count({ where }),
    prisma.inquiryChangeLog.findFirst({
      where: tenantChangeLogWhere(tenantId),
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ]);
  res.json({
    count,
    seenAt: seenAt ? seenAt.toISOString() : null,
    latestAt: latest?.createdAt ? latest.createdAt.toISOString() : null,
  });
});

/** 변경 이력 확인(읽음) 처리 — 마지막 확인 시각을 현재로 갱신 */
router.post('/mark-seen', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;

  const now = new Date();
  await prisma.user.update({
    where: { id: user.userId },
    data: { changeLogSeenAt: now },
  });
  res.json({ ok: true, seenAt: now.toISOString() });
});

/** 대시보드 최근 N건 */
router.get('/recent', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;

  const { limit = '10' } = req.query;
  const take = Math.min(50, Math.max(1, parseInt(String(limit), 10) || 10));
  const rows = await prisma.inquiryChangeLog.findMany({
    where: tenantChangeLogWhere(tenantId),
    orderBy: { createdAt: 'desc' },
    take,
    include: logInclude,
  });
  const actorMap = await attachActorNames(rows);
  const items = rows.map((r) =>
    toChangeHistoryItemDto(r, r.actorId ? actorMap.get(r.actorId) ?? null : null)
  );
  res.json({ items });
});

/** 전체 목록 (필터·페이지) */
router.get('/', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;

  const { customerName, limit = '100', offset = '0' } = req.query;
  const take = Math.min(500, Math.max(1, parseInt(String(limit), 10) || 100));
  const skip = Math.max(0, parseInt(String(offset), 10) || 0);

  const nameFilter =
    typeof customerName === 'string' && customerName.trim()
      ? { inquiry: { customerName: { contains: customerName.trim() }, tenantId } }
      : {};

  const where: Prisma.InquiryChangeLogWhereInput = {
    AND: [tenantChangeLogWhere(tenantId), nameFilter],
  };

  const [rows, total] = await Promise.all([
    prisma.inquiryChangeLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
      include: logInclude,
    }),
    prisma.inquiryChangeLog.count({ where }),
  ]);

  const actorMap = await attachActorNames(rows);
  const items = rows.map((r) =>
    toChangeHistoryItemDto(r, r.actorId ? actorMap.get(r.actorId) ?? null : null)
  );
  res.json({ items, total });
});

/** 최고 관리자만 — 비밀번호 확인 후 삭제 */
router.delete('/:id', superAdminOnly, async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;

  const { id } = req.params;
  const body = req.body as { password?: string };
  const password = body.password != null ? String(body.password) : '';
  if (!password) {
    res.status(400).json({ error: '비밀번호를 입력해주세요.' });
    return;
  }

  const user = (req as unknown as { user: AuthPayload }).user;
  const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
  if (!dbUser) {
    res.status(401).json({ error: '사용자를 찾을 수 없습니다.' });
    return;
  }
  const valid = await bcrypt.compare(password, dbUser.passwordHash);
  if (!valid) {
    res.status(401).json({ error: '비밀번호가 일치하지 않습니다.' });
    return;
  }

  const existing = await prisma.inquiryChangeLog.findFirst({
    where: { id, ...tenantChangeLogWhere(tenantId) },
  });
  if (!existing) {
    res.status(404).json({ error: '히스토리를 찾을 수 없습니다.' });
    return;
  }

  await prisma.inquiryChangeLog.delete({ where: { id } });
  res.json({ ok: true });
});

export default router;
