import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware, type AuthPayload } from '../auth/auth.middleware.js';
import {
  staffHasAnyPermission,
  staffMarketerRoleOnly,
} from '../auth/marketerPermission.middleware.js';
import { getTenantIdFromAuth } from '../tenants/tenant.middleware.js';
import { countUnseenPending } from '../review-payback/reviewPayback.service.js';

const router = Router();

function isDbUnavailable(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const code = 'code' in err ? String((err as { code: unknown }).code) : '';
  return code === 'P1001' || code === 'P1002';
}

/** 관리자 GNB: 미읽 메시지 + 미처리 C/S + 페이백 — 권한 있는 항목만 COUNT */
router.get('/nav-badges', authMiddleware, staffMarketerRoleOnly, async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const { userId } = user;
  const tenantId = getTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  try {
    const [canMessages, canCs, canReviewPayback] = await Promise.all([
      staffHasAnyPermission(user, ['messages.send']),
      staffHasAnyPermission(user, ['cs.view']),
      staffHasAnyPermission(user, ['inquiry.view']),
    ]);
    const [unreadCount, csPendingCount, reviewPaybackUnseenCount, leadsPendingCount] = await Promise.all([
      canMessages
        ? prisma.message.count({
            where: { tenantId, receiverId: userId, readAt: null },
          })
        : Promise.resolve(0),
      canCs
        ? prisma.csReport.count({ where: { tenantId, status: 'RECEIVED' } })
        : Promise.resolve(0),
      canReviewPayback ? countUnseenPending(tenantId) : Promise.resolve(0),
      user.role === 'ADMIN' || user.role === 'MARKETER'
        ? prisma.landingContactInquiry.count({ where: { tenantId, status: 'NEW' } })
        : Promise.resolve(0),
    ]);
    res.json({ unreadCount, csPendingCount, reviewPaybackUnseenCount, leadsPendingCount });
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
