import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { listActivePlatformPromos } from './platformPartnerPromoActive.service.js';

const router = Router();

/** GET /platform-promos/active — teamAuthMiddleware 이후 마운트 */
router.get('/platform-promos/active', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  if (user.role !== 'EXTERNAL_PARTNER') {
    res.json({ items: [] });
    return;
  }
  const items = await listActivePlatformPromos(prisma, 'external_partner');
  res.setHeader('Cache-Control', 'private, max-age=60');
  res.json({ items });
});

export default router;
