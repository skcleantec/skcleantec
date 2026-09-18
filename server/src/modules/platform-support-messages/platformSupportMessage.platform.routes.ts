import { Router } from 'express';
import { platformAuthMiddleware, type PlatformScopedRequest } from '../platform/platformAuth.middleware.js';
import {
  PlatformSupportNotFoundError,
  PlatformSupportValidationError,
  broadcastPlatformSupportMessage,
  countPlatformSupportUnreadSafe,
  getPlatformSupportThread,
  listBroadcastableTenants,
  listPlatformSupportThreads,
  postPlatformSupportMessage,
} from './platformSupportMessage.service.js';

const router = Router();

router.use(platformAuthMiddleware);

function parseLimitOffset(req: { query: Record<string, unknown> }) {
  const limitRaw = Number(req.query.limit);
  const offsetRaw = Number(req.query.offset);
  const limit = Number.isFinite(limitRaw) ? Math.min(100, Math.max(1, Math.floor(limitRaw))) : 30;
  const offset = Number.isFinite(offsetRaw) ? Math.max(0, Math.floor(offsetRaw)) : 0;
  return { limit, offset };
}

router.get('/unread-count', async (_req, res) => {
  const count = await countPlatformSupportUnreadSafe();
  res.json({ count });
});

router.get('/tenants', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  const items = await listBroadcastableTenants(q);
  res.json({ items });
});

router.get('/threads', async (req, res) => {
  const { limit, offset } = parseLimitOffset(req);
  const q = typeof req.query.q === 'string' ? req.query.q : undefined;
  const waitingRaw = typeof req.query.waiting === 'string' ? req.query.waiting : 'all';
  const waiting = waitingRaw === 'PLATFORM' || waitingRaw === 'TENANT' ? waitingRaw : 'all';
  const unreadOnly = req.query.unreadOnly === '1' || req.query.unreadOnly === 'true';
  const result = await listPlatformSupportThreads({ q, waiting, unreadOnly, limit, offset });
  res.json(result);
});

router.get('/threads/:tenantId', async (req, res) => {
  try {
    const thread = await getPlatformSupportThread(req.params.tenantId);
    res.json(thread);
  } catch (e) {
    if (e instanceof PlatformSupportNotFoundError) {
      res.status(404).json({ error: e.message });
      return;
    }
    throw e;
  }
});

router.post('/threads/:tenantId/messages', async (req, res) => {
  const platformUser = (req as unknown as PlatformScopedRequest).platformUser;
  try {
    const body = typeof req.body?.body === 'string' ? req.body.body : '';
    const message = await postPlatformSupportMessage({
      tenantId: req.params.tenantId,
      platformUserId: platformUser.platformUserId,
      body,
    });
    res.json(message);
  } catch (e) {
    if (e instanceof PlatformSupportValidationError) {
      res.status(400).json({ error: e.message });
      return;
    }
    if (e instanceof PlatformSupportNotFoundError) {
      res.status(404).json({ error: e.message });
      return;
    }
    throw e;
  }
});

router.post('/broadcast', async (req, res) => {
  const platformUser = (req as unknown as PlatformScopedRequest).platformUser;
  try {
    const body = typeof req.body?.body === 'string' ? req.body.body : '';
    const tenantIds = Array.isArray(req.body?.tenantIds)
      ? (req.body.tenantIds as unknown[]).filter((id): id is string => typeof id === 'string')
      : undefined;
    const result = await broadcastPlatformSupportMessage({
      platformUserId: platformUser.platformUserId,
      body,
      tenantIds,
    });
    res.json(result);
  } catch (e) {
    if (e instanceof PlatformSupportValidationError) {
      res.status(400).json({ error: e.message });
      return;
    }
    throw e;
  }
});

export default router;
