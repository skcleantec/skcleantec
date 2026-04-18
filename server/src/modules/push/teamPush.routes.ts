import { Router } from 'express';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { prisma } from '../../lib/prisma.js';
import { getVapidPublicKey, isWebPushConfigured } from './webPushConfig.js';

const router = Router();

router.get('/vapid-public-key', (_req, res) => {
  if (!isWebPushConfigured()) {
    res.json({ configured: false, publicKey: null as string | null });
    return;
  }
  res.json({ configured: true, publicKey: getVapidPublicKey() });
});

router.post('/subscribe', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const body = req.body as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
  if (!isWebPushConfigured()) {
    res.status(503).json({ error: 'Web Push가 서버에 설정되지 않았습니다.' });
    return;
  }
  const endpoint = typeof body.endpoint === 'string' ? body.endpoint.trim() : '';
  const p256dh = typeof body.keys?.p256dh === 'string' ? body.keys.p256dh.trim() : '';
  const auth = typeof body.keys?.auth === 'string' ? body.keys.auth.trim() : '';
  if (!endpoint || !p256dh || !auth) {
    res.status(400).json({ error: 'endpoint, keys.p256dh, keys.auth가 필요합니다.' });
    return;
  }
  const ua = typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'].slice(0, 512) : null;
  await prisma.teamLeaderWebPushSubscription.upsert({
    where: { endpoint },
    create: {
      userId: user.userId,
      endpoint,
      p256dh,
      auth,
      userAgent: ua,
    },
    update: {
      userId: user.userId,
      p256dh,
      auth,
      userAgent: ua,
    },
  });
  res.json({ ok: true });
});

router.delete('/subscribe', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const body = req.body as { endpoint?: string };
  const endpoint = typeof body.endpoint === 'string' ? body.endpoint.trim() : '';
  if (!endpoint) {
    res.status(400).json({ error: 'endpoint가 필요합니다.' });
    return;
  }
  await prisma.teamLeaderWebPushSubscription.deleteMany({
    where: { userId: user.userId, endpoint },
  });
  res.json({ ok: true });
});

export default router;
