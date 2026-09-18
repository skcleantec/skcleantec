import { Router } from 'express';
import { authMiddleware, type AuthPayload } from '../auth/auth.middleware.js';
import { staffMarketerRoleOnly } from '../auth/marketerPermission.middleware.js';
import { getTenantIdFromAuth } from '../tenants/tenant.middleware.js';
import {
  PlatformSupportValidationError,
  countTenantSupportUnread,
  getTenantSupportSummary,
  getTenantSupportThread,
  postTenantSupportMessage,
} from './platformSupportMessage.service.js';

const router = Router();

router.use(authMiddleware, staffMarketerRoleOnly);

function actor(req: { user?: AuthPayload }) {
  const user = req.user;
  const tenantId = getTenantIdFromAuth(user);
  if (!user || !tenantId) return null;
  return { user, tenantId };
}

router.get('/unread-count', async (req, res) => {
  const a = actor(req as { user?: AuthPayload });
  if (!a) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const count = await countTenantSupportUnread(a.tenantId, a.user.userId);
  res.json({ count });
});

router.get('/summary', async (req, res) => {
  const a = actor(req as { user?: AuthPayload });
  if (!a) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const summary = await getTenantSupportSummary(a.tenantId, a.user.userId);
  res.json(summary);
});

router.get('/thread', async (req, res) => {
  const a = actor(req as { user?: AuthPayload });
  if (!a) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const thread = await getTenantSupportThread(a.tenantId, a.user.userId);
  res.json(thread);
});

router.post('/messages', async (req, res) => {
  const a = actor(req as { user?: AuthPayload });
  if (!a) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  try {
    const body = typeof req.body?.body === 'string' ? req.body.body : '';
    const message = await postTenantSupportMessage({
      tenantId: a.tenantId,
      userId: a.user.userId,
      userName: a.user.email,
      userRole: a.user.role,
      body,
    });
    res.json(message);
  } catch (e) {
    if (e instanceof PlatformSupportValidationError) {
      res.status(400).json({ error: e.message });
      return;
    }
    throw e;
  }
});

export default router;
