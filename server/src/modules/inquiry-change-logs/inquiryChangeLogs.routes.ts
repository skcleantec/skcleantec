import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { adminOrMarketer, superAdminOnly } from '../auth/auth.middleware.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import {
  toChangeHistoryItemDto,
} from './inquiryChangeLogs.helpers.js';

const router = Router();

router.use(authMiddleware);
router.use(adminOrMarketer);

const logInclude = {
  inquiry: { select: { customerName: true } },
} as const;

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

/** 대시보드 최근 N건 */
router.get('/recent', async (req, res) => {
  const { limit = '10' } = req.query;
  const take = Math.min(50, Math.max(1, parseInt(String(limit), 10) || 10));
  const rows = await prisma.inquiryChangeLog.findMany({
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
  const { customerName, limit = '100', offset = '0' } = req.query;
  const take = Math.min(500, Math.max(1, parseInt(String(limit), 10) || 100));
  const skip = Math.max(0, parseInt(String(offset), 10) || 0);

  const nameFilter =
    typeof customerName === 'string' && customerName.trim()
      ? { inquiry: { customerName: { contains: customerName.trim() } } }
      : {};

  const [rows, total] = await Promise.all([
    prisma.inquiryChangeLog.findMany({
      where: nameFilter,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
      include: logInclude,
    }),
    prisma.inquiryChangeLog.count({ where: nameFilter }),
  ]);

  const actorMap = await attachActorNames(rows);
  const items = rows.map((r) =>
    toChangeHistoryItemDto(r, r.actorId ? actorMap.get(r.actorId) ?? null : null)
  );
  res.json({ items, total });
});

/** 최고 관리자만 — 비밀번호 확인 후 삭제 */
router.delete('/:id', superAdminOnly, async (req, res) => {
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

  const existing = await prisma.inquiryChangeLog.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: '히스토리를 찾을 수 없습니다.' });
    return;
  }

  await prisma.inquiryChangeLog.delete({ where: { id } });
  res.json({ ok: true });
});

export default router;
