import { Router, type Request, type Response, type NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import type { AuthPayload } from '../auth/auth.middleware.js';

/** 비동기 핸들러 에러를 JSON 500으로 내려주는 래퍼 */
function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch((err) => {
      console.error('[user-custom-calendars]', req.method, req.originalUrl, err);
      if (res.headersSent) return;
      const message =
        err instanceof Error && err.message
          ? err.message
          : '요청을 처리하지 못했습니다.';
      res.status(500).json({ error: message });
    });
  };
}

/**
 * 사용자별 맞춤 '지역 필터 캘린더' CRUD.
 *
 * - 본인 소유만 조회/수정/삭제 가능
 * - 삭제는 프로젝트 규칙에 따라 본인 비밀번호 확인 후에만 처리
 * - 실시간 동기화는 해당 데이터가 팀장 화면에 직접 영향을 주지 않으므로 inbox:refresh 전송 불필요
 */
const router = Router();

router.use(authMiddleware);

const COLOR_KEYS = ['teal', 'amber', 'rose', 'violet', 'sky', 'emerald', 'slate'] as const;

function authUser(req: import('express').Request): AuthPayload {
  return (req as unknown as { user: AuthPayload }).user;
}

function sanitizeRegions(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const cleaned: string[] = [];
  const seen = new Set<string>();
  for (const v of value) {
    if (typeof v !== 'string') continue;
    const s = v.trim();
    if (!s) continue;
    if (s.length > 40) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    cleaned.push(s);
    if (cleaned.length >= 200) break;
  }
  return cleaned;
}

function sanitizeColorKey(value: unknown): string {
  if (typeof value !== 'string') return 'teal';
  const k = value.trim();
  return (COLOR_KEYS as readonly string[]).includes(k) ? k : 'teal';
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { userId } = authUser(req);
    const list = await prisma.userCustomCalendar.findMany({
      where: { userId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
    res.json({ items: list });
  })
);

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const { userId } = authUser(req);
    const body = (req.body ?? {}) as { name?: unknown; regions?: unknown; colorKey?: unknown };

    const rawName = typeof body.name === 'string' ? body.name.trim() : '';
    if (!rawName) {
      res.status(400).json({ error: '제목을 입력해주세요.' });
      return;
    }
    if (rawName.length > 64) {
      res.status(400).json({ error: '제목은 64자 이내로 입력해주세요.' });
      return;
    }

    const regions = sanitizeRegions(body.regions);
    if (!regions || regions.length === 0) {
      res.status(400).json({ error: '필터 지역을 1개 이상 선택해주세요.' });
      return;
    }

    const colorKey = sanitizeColorKey(body.colorKey);

    const last = await prisma.userCustomCalendar.findFirst({
      where: { userId },
      orderBy: { sortOrder: 'desc' },
    });
    const sortOrder = (last?.sortOrder ?? -1) + 1;

    const created = await prisma.userCustomCalendar.create({
      data: { userId, name: rawName, regions, colorKey, sortOrder },
    });
    res.json({ item: created });
  })
);

router.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const { userId } = authUser(req);
    const { id } = req.params;
    const existing = await prisma.userCustomCalendar.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      res.status(404).json({ error: '캘린더를 찾을 수 없습니다.' });
      return;
    }

    const body = (req.body ?? {}) as {
      name?: unknown;
      regions?: unknown;
      colorKey?: unknown;
      sortOrder?: unknown;
    };

    const data: {
      name?: string;
      regions?: string[];
      colorKey?: string;
      sortOrder?: number;
    } = {};

    if (body.name !== undefined) {
      if (typeof body.name !== 'string') {
        res.status(400).json({ error: '제목이 올바르지 않습니다.' });
        return;
      }
      const n = body.name.trim();
      if (!n || n.length > 64) {
        res.status(400).json({ error: '제목을 1~64자로 입력해주세요.' });
        return;
      }
      data.name = n;
    }

    if (body.regions !== undefined) {
      const regions = sanitizeRegions(body.regions);
      if (!regions || regions.length === 0) {
        res.status(400).json({ error: '필터 지역을 1개 이상 선택해주세요.' });
        return;
      }
      data.regions = regions;
    }

    if (body.colorKey !== undefined) {
      data.colorKey = sanitizeColorKey(body.colorKey);
    }

    if (body.sortOrder !== undefined) {
      const n = Number(body.sortOrder);
      if (Number.isFinite(n)) data.sortOrder = Math.max(0, Math.floor(n));
    }

    const updated = await prisma.userCustomCalendar.update({ where: { id }, data });
    res.json({ item: updated });
  })
);

/** 삭제 — 본인 비밀번호 확인 필수(프로젝트 규칙) */
router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const { userId } = authUser(req);
    const { id } = req.params;

    const body = (req.body ?? {}) as { password?: unknown };
    const password = typeof body.password === 'string' ? body.password : '';
    if (!password) {
      res.status(400).json({ error: '비밀번호를 입력해주세요.' });
      return;
    }

    const existing = await prisma.userCustomCalendar.findUnique({ where: { id } });
    if (!existing || existing.userId !== userId) {
      res.status(404).json({ error: '캘린더를 찾을 수 없습니다.' });
      return;
    }

    const dbUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!dbUser) {
      res.status(401).json({ error: '사용자를 찾을 수 없습니다.' });
      return;
    }

    const valid = await bcrypt.compare(password, dbUser.passwordHash);
    if (!valid) {
      res.status(401).json({ error: '비밀번호가 일치하지 않습니다.' });
      return;
    }

    await prisma.userCustomCalendar.delete({ where: { id } });
    res.json({ ok: true });
  })
);

export default router;
