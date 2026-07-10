import { Router } from 'express';
import { authMiddleware, type AuthPayload } from '../auth/auth.middleware.js';
import { staffMarketerRoleOnly } from '../auth/marketerPermission.middleware.js';
import { requireTenantIdFromAuth } from './tenantScope.helpers.js';
import { getTenantSubscriptionForAdmin } from './tenantSubscription.service.js';

const router = Router();

router.use(authMiddleware, staffMarketerRoleOnly);

/** GET /api/admin/tenant-subscription — 가입·플랜·사용 중 서비스·사용량 (로그인 업무 계정 공통) */
router.get('/', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;
  try {
    const data = await getTenantSubscriptionForAdmin(tenantId);
    res.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '조회에 실패했습니다.';
    res.status(400).json({ error: msg });
  }
});

export default router;
