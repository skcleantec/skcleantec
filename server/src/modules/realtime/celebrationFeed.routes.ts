import { Router } from 'express';
import { authMiddleware, adminOrMarketer } from '../auth/auth.middleware.js';
import { getCelebrationFeedHeadId, listCelebrationFeedAfter } from './celebrationFeedStore.js';

const router = Router();

/**
 * GET /api/realtime/celebrations — no `after`: { items: [], lastId } for client cursor sync.
 * GET ?after=N — items with eventId > N (ADMIN/MARKETER only).
 */
router.get('/celebrations', authMiddleware, adminOrMarketer, (req, res) => {
  const lastId = getCelebrationFeedHeadId();
  const raw = req.query.after;
  if (raw === undefined || raw === '') {
    res.json({ items: [], lastId });
    return;
  }
  const afterNum = parseInt(String(raw), 10);
  const afterId = Number.isFinite(afterNum) ? afterNum : 0;
  res.json({
    items: listCelebrationFeedAfter(afterId),
    lastId,
  });
});

export default router;
