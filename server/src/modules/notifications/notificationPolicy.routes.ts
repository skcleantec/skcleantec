import { Router } from 'express';
import { authMiddleware, adminRoleOnly, type AuthPayload } from '../auth/auth.middleware.js';
import { requireTenantIdFromAuth } from '../tenants/tenantScope.helpers.js';
import {
  getTenantNotificationPolicy,
  upsertTenantNotificationPolicy,
} from './notificationPolicy.service.js';
import {
  mergeTenantNotificationPolicy,
  type TenantNotificationPolicyDto,
} from '../../lib/notificationPolicy.helpers.js';

const router = Router();

router.use(authMiddleware);
router.use(adminRoleOnly);

router.get('/', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;
  const policy = await getTenantNotificationPolicy(tenantId);
  res.json({ policy });
});

router.patch('/', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;
  const body = req.body as { policy?: unknown };
  if (!body.policy || typeof body.policy !== 'object') {
    res.status(400).json({ error: 'policy 객체가 필요합니다.' });
    return;
  }
  const merged = mergeTenantNotificationPolicy(body.policy);
  const saved = await upsertTenantNotificationPolicy(tenantId, merged as TenantNotificationPolicyDto);
  res.json({ policy: saved });
});

export default router;
