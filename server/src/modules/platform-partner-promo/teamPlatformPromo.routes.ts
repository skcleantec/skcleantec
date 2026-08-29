import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { listActivePlatformPromos } from './platformPartnerPromoActive.service.js';

const router = Router();

/** GET /platform-promos/active — teamAuthMiddleware 이후 마운트 */
router.get('/platform-promos/active', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  let audience: 'external_partner' | 'tenant_staff' | null = null;
  if (user.role === 'EXTERNAL_PARTNER') {
    audience = 'external_partner';
  } else if (user.role === 'TEAM_LEADER') {
    audience = 'tenant_staff';
  }
  if (!audience) {
    res.json({ items: [] });
    return;
  }
  const items = await listActivePlatformPromos(prisma, audience);
  res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.json({ items });
});

export default router;
