import { Router, type Request, type Response, type NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware, adminOnly, adminOrMarketer, type AuthPayload } from '../auth/auth.middleware.js';
import { requireTenantIdFromAuth } from '../tenants/tenantScope.helpers.js';
import {
  createServiceZone,
  deleteServiceZoneWithPassword,
  listServiceZones,
  ServiceZoneNotFoundError,
  ServiceZoneValidationError,
  updateServiceZone,
} from './serviceZone.service.js';

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch((err) => {
      console.error('[service-zones]', req.method, req.originalUrl, err);
      if (res.headersSent) return;
      const message =
        err instanceof Error && err.message ? err.message : '요청을 처리하지 못했습니다.';
      res.status(500).json({ error: message });
    });
  };
}

const router = Router();

router.use(authMiddleware);
router.use(adminOrMarketer);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
    if (!tenantId) return;
    const includeInactive =
      (req as unknown as { user: AuthPayload }).user.role === 'ADMIN' &&
      req.query.includeInactive === '1';
    const items = await listServiceZones(prisma, tenantId, { includeInactive });
    res.json({ items });
  }),
);

router.post(
  '/',
  adminOnly,
  asyncHandler(async (req, res) => {
    const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
    if (!tenantId) return;
    try {
      const created = await createServiceZone(prisma, tenantId, req.body ?? {});
      res.status(201).json(created);
    } catch (e) {
      if (e instanceof ServiceZoneValidationError) {
        res.status(400).json({ error: e.message });
        return;
      }
      throw e;
    }
  }),
);

router.patch(
  '/:id',
  adminOnly,
  asyncHandler(async (req, res) => {
    const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
    if (!tenantId) return;
    try {
      const updated = await updateServiceZone(prisma, tenantId, req.params.id, req.body ?? {});
      res.json(updated);
    } catch (e) {
      if (e instanceof ServiceZoneNotFoundError) {
        res.status(404).json({ error: e.message });
        return;
      }
      if (e instanceof ServiceZoneValidationError) {
        res.status(400).json({ error: e.message });
        return;
      }
      throw e;
    }
  }),
);

router.delete(
  '/:id',
  adminOnly,
  asyncHandler(async (req, res) => {
    const auth = (req as unknown as { user: AuthPayload }).user;
    const tenantId = await requireTenantIdFromAuth(res, auth);
    if (!tenantId) return;
    const body = (req.body ?? {}) as { password?: unknown };
    const password = typeof body.password === 'string' ? body.password : '';
    if (!password.trim()) {
      res.status(400).json({ error: '비밀번호를 입력해주세요.' });
      return;
    }
    const actor = await prisma.user.findFirst({
      where: { id: auth.userId, tenantId },
      select: { passwordHash: true },
    });
    if (!actor) {
      res.status(403).json({ error: '세션이 유효하지 않습니다.' });
      return;
    }
    try {
      await deleteServiceZoneWithPassword(
        prisma,
        tenantId,
        req.params.id,
        actor.passwordHash,
        password,
        bcrypt.compare,
      );
      res.json({ ok: true });
    } catch (e) {
      if (e instanceof ServiceZoneNotFoundError) {
        res.status(404).json({ error: e.message });
        return;
      }
      if (e instanceof ServiceZoneValidationError) {
        res.status(400).json({ error: e.message });
        return;
      }
      throw e;
    }
  }),
);

export default router;
