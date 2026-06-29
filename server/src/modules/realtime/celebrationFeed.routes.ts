import { Router } from 'express';
import { authMiddleware, adminOrMarketer, type AuthPayload } from '../auth/auth.middleware.js';
import { requireTenantIdFromAuth } from '../tenants/tenantScope.helpers.js';
import { getCelebrationFeedHeadId, listCelebrationFeedAfter } from './celebrationFeedStore.js';

const router = Router();

/**
 * GET /api/realtime/celebrations — no `after`: { items: [], lastId } for client cursor sync.
 * GET ?after=N — items with eventId > N for **현재 JWT 테넌트만** (ADMIN/MARKETER).
 */
router.get('/celebrations', authMiddleware, adminOrMarketer, async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;

  const lastId = getCelebrationFeedHeadId();
  const raw = req.query.after;
  if (raw === undefined || raw === '') {
    res.json({ items: [], lastId });
    return;
  }
  const afterNum = parseInt(String(raw), 10);
  const afterId = Number.isFinite(afterNum) ? afterNum : 0;
  res.json({
    items: listCelebrationFeedAfter(afterId, tenantId),
    lastId,
  });
});

export default router;
