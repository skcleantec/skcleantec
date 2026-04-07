import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware, adminOrMarketer, type AuthPayload } from '../auth/auth.middleware.js';

const router = Router();

/** 관리자 GNB: 미읽 메시지 + 미처리(접수) C/S — 한 요청으로 병렬 COUNT */
router.get('/nav-badges', authMiddleware, adminOrMarketer, async (req, res) => {
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  const [unreadCount, csPendingCount] = await Promise.all([
    prisma.message.count({
      where: { receiverId: userId, readAt: null },
    }),
    prisma.csReport.count({ where: { status: 'RECEIVED' } }),
  ]);
  res.json({ unreadCount, csPendingCount });
});

export default router;
