import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { teamAuthMiddleware } from '../auth/auth.middleware.team.js';
import type { AuthPayload } from '../auth/auth.middleware.js';

const router = Router();

router.use(teamAuthMiddleware);

router.get('/inquiries', async (req, res) => {
  const { userId } = (req as { user: AuthPayload }).user;
  const items = await prisma.inquiry.findMany({
    where: {
      assignments: {
        some: { teamLeaderId: userId },
      },
    },
    orderBy: { preferredDate: 'asc' },
    include: {
      assignments: {
        include: { teamLeader: { select: { id: true, name: true } } },
      },
    },
  });
  res.json({ items });
});

router.get('/schedule', async (req, res) => {
  const { userId } = (req as { user: AuthPayload }).user;
  const { start, end } = req.query as { start?: string; end?: string };
  const now = new Date();
  const startDate = start ? new Date(start) : new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = end
    ? new Date(end)
    : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const items = await prisma.inquiry.findMany({
    where: {
      preferredDate: { gte: startDate, lte: endDate },
      status: { not: 'CANCELLED' },
      assignments: {
        some: { teamLeaderId: userId },
      },
    },
    orderBy: [{ preferredDate: 'asc' }, { preferredTime: 'asc' }],
    include: {
      assignments: {
        include: { teamLeader: { select: { id: true, name: true } } },
      },
    },
  });
  res.json({ items });
});

export default router;
