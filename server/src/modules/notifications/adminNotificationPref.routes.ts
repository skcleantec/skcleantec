import { Router } from 'express';
import { authMiddleware, type AuthPayload } from '../auth/auth.middleware.js';
import { requireTenantIdFromAuth } from '../tenants/tenantScope.helpers.js';
import {
  getTenantNotificationPolicy,
  getUserNotificationPreferences,
  upsertUserNotificationPreferences,
} from './notificationPolicy.service.js';
import {
  mergeUserNotificationPreferences,
  buildTeamNotificationSettingsView,
} from '../../lib/notificationPolicy.helpers.js';

const router = Router();

router.use(authMiddleware);

router.get('/', async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, auth);
  if (!tenantId) return;
  const { userId, role } = auth;
  if (role !== 'ADMIN' && role !== 'MARKETER') {
    res.status(403).json({ error: '관리·마케터 계정에서만 이용할 수 있습니다.' });
    return;
  }
  const [tenantPolicy, userPref] = await Promise.all([
    getTenantNotificationPolicy(tenantId),
    getUserNotificationPreferences(tenantId, userId),
  ]);
  res.json({
    items: buildTeamNotificationSettingsView(tenantPolicy, userPref),
  });
});

router.patch('/', async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, auth);
  if (!tenantId) return;
  const { userId, role } = auth;
  if (role !== 'ADMIN' && role !== 'MARKETER') {
    res.status(403).json({ error: '관리·마케터 계정에서만 이용할 수 있습니다.' });
    return;
  }
  const body = req.body as { kinds?: unknown };
  const merged = mergeUserNotificationPreferences({ kinds: body.kinds });
  const saved = await upsertUserNotificationPreferences(tenantId, userId, merged);
  const tenantPolicy = await getTenantNotificationPolicy(tenantId);
  res.json({
    items: buildTeamNotificationSettingsView(tenantPolicy, saved),
  });
});

export default router;
