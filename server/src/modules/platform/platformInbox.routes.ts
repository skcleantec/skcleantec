import { Router } from 'express';
import { platformAuthMiddleware, type PlatformScopedRequest } from './platformAuth.middleware.js';
import {
  applyPlatformInboxAction,
  applyPlatformInboxBulk,
  getPlatformInbox,
  type InboxMoneyKind,
} from './platformInbox.service.js';

const router = Router();
router.use(platformAuthMiddleware);

router.get('/', async (_req, res) => {
  try {
    res.json(await getPlatformInbox());
  } catch (err) {
    console.error('[platform inbox]', err);
    res.status(500).json({ error: '오늘 할 일을 불러오지 못했습니다.' });
  }
});

function readKind(value: unknown): InboxMoneyKind | null {
  if (value === 'charge' || value === 'deposit' || value === 'overdue' || value === 'reconcile') return value;
  return null;
}

router.post('/actions', async (req, res) => {
  const user = (req as PlatformScopedRequest).platformUser;
  const body = req.body as {
    kind?: unknown;
    id?: unknown;
    tenantId?: unknown;
    action?: unknown;
    items?: unknown;
  };

  try {
    if (Array.isArray(body.items)) {
      const items = body.items.flatMap((raw) => {
        if (!raw || typeof raw !== 'object') return [];
        const row = raw as { kind?: unknown; id?: unknown; tenantId?: unknown };
        const kind = readKind(row.kind);
        if (!kind || typeof row.id !== 'string' || typeof row.tenantId !== 'string') return [];
        return [{ kind, id: row.id, tenantId: row.tenantId }];
      });
      if (items.length === 0) {
        res.status(400).json({ error: '승인할 항목을 선택해 주세요.' });
        return;
      }
      const results = await applyPlatformInboxBulk(items, user.platformUserId);
      res.json({ results, inbox: await getPlatformInbox() });
      return;
    }

    const kind = readKind(body.kind);
    const action = body.action === 'approve' || body.action === 'reject' ? body.action : null;
    if (!kind || !action || typeof body.id !== 'string' || typeof body.tenantId !== 'string') {
      res.status(400).json({ error: '처리할 항목이 올바르지 않습니다.' });
      return;
    }
    await applyPlatformInboxAction({
      kind,
      id: body.id,
      tenantId: body.tenantId,
      action,
      platformUserId: user.platformUserId,
    });
    res.json({ ok: true, inbox: await getPlatformInbox() });
  } catch (err) {
    const message = err instanceof Error ? err.message : '처리하지 못했습니다.';
    const status = message.includes('이미') ? 409 : 400;
    res.status(status).json({ error: message });
  }
});

export default router;
