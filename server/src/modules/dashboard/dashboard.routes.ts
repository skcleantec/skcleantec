import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { adminOnly } from '../auth/auth.middleware.js';

const router = Router();

router.use(authMiddleware);
router.use(adminOnly);

router.get('/stats', async (_req, res) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [todayCount, unassignedCount, inProgressCount] = await Promise.all([
    prisma.inquiry.count({
      where: {
        createdAt: { gte: today, lt: tomorrow },
      },
    }),
    prisma.inquiry.count({
      where: { status: 'RECEIVED' },
    }),
    prisma.inquiry.count({
      where: { status: 'IN_PROGRESS' },
    }),
  ]);

  res.json({
    todayCount,
    unassignedCount,
    inProgressCount,
  });
});

export default router;
