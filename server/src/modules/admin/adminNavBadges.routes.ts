import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware, adminOrMarketer, type AuthPayload } from '../auth/auth.middleware.js';
import { getTenantIdFromAuth } from '../tenants/tenant.middleware.js';
import { countUnseenPending } from '../review-payback/reviewPayback.service.js';

const router = Router();

function isDbUnavailable(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = 'code' in err ? String((err as { code: unknown }).code) : '';
  return code === 'P1001' || code === 'P1002';
}

/** 관리자 GNB: 미읽 메시지 + 미처리(접수) C/S — 한 요청으로 병렬 COUNT */
router.get('/nav-badges', authMiddleware, adminOrMarketer, async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const { userId } = user;
  const tenantId = getTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  try {
    const [unreadCount, csPendingCount, reviewPaybackUnseenCount] = await Promise.all([
      prisma.message.count({
        where: { receiverId: userId, readAt: null },
      }),
      prisma.csReport.count({ where: { tenantId, status: 'RECEIVED' } }),
      countUnseenPending(tenantId),
    ]);
    res.json({ unreadCount, csPendingCount, reviewPaybackUnseenCount });
  } catch (err) {
    if (isDbUnavailable(err)) {
      console.error('[nav-badges] DB unavailable:', err);
      res.status(503).json({ error: 'database_unavailable' });
      return;
    }
    throw err;
  }
});

export default router;
