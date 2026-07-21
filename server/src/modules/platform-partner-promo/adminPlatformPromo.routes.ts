import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware, type AuthPayload } from '../auth/auth.middleware.js';
import { listActivePlatformPromos } from './platformPartnerPromoActive.service.js';

const router = Router();

/** GET /api/admin/platform-promos/active — 테넌트 대시보드 배너 */
router.get('/active', authMiddleware, async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  if (user.role !== 'ADMIN' && user.role !== 'MARKETER') {
    res.status(403).json({ error: '관리자·마케터만 이용할 수 있습니다.' });
    return;
  }
  const items = await listActivePlatformPromos(prisma, 'tenant_staff');
  res.setHeader('Cache-Control', 'private, max-age=60');
  res.json({ items });
});

export default router;
