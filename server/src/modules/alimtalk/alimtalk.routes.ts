import { Router } from 'express';
import { authMiddleware, type AuthPayload } from '../auth/auth.middleware.js';
import { requireTenantAuth } from '../tenants/tenant.middleware.js';
import { requireTenantIdFromAuth } from '../tenants/tenantScope.helpers.js';
import { requireFeature } from '../tenants/requireTenantFeature.js';
import { ALIMTALK_MODULE_ID } from '../../lib/alimtalkPolicy.js';
import { getTenantAlimtalkStatus } from './alimtalkSend.service.js';

const router = Router();

router.use(authMiddleware, requireTenantAuth, requireFeature(ALIMTALK_MODULE_ID));

router.get('/status', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  const status = await getTenantAlimtalkStatus(tenantId);
  if (!status) {
    res.status(404).json({ error: '업체를 찾을 수 없습니다.' });
    return;
  }
  res.json(status);
});

export default router;
