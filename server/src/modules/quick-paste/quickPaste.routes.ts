import { Router } from 'express';
import type { UserRole } from '@prisma/client';
import { authMiddleware, type AuthPayload } from '../auth/auth.middleware.js';
import { requireStaffPermission } from '../auth/marketerPermission.middleware.js';
import { getTenantIdFromAuth } from '../tenants/tenant.middleware.js';
import { mapTenantCoinError } from '../tenants/tenantCoin.service.js';
import {
  buildQuickPastePreview,
  commitQuickPasteIntake,
  QuickPasteValidationError,
} from './quickPasteCommit.service.js';

const router = Router();

router.use(authMiddleware);
router.use(requireStaffPermission('inquiry.create'));

router.post('/parse', async (req, res) => {
  try {
    const user = (req as unknown as { user: AuthPayload }).user;
    const tenantId = getTenantIdFromAuth(user);
    if (!tenantId) {
      res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
      return;
    }
    const rawText = typeof req.body?.rawText === 'string' ? req.body.rawText : '';
    const preview = await buildQuickPastePreview(rawText, tenantId);
    res.json(preview);
  } catch (e) {
    const coinErr = mapTenantCoinError(e);
    if (coinErr) {
      res.status(coinErr.status).json({ error: coinErr.message });
      return;
    }
    console.error('[quick-paste] parse', e);
    res.status(500).json({ error: '분석에 실패했습니다.' });
  }
});

router.post('/commit', async (req, res) => {
  try {
    const user = (req as unknown as { user: AuthPayload }).user;
    const tenantId = getTenantIdFromAuth(user);
    if (!tenantId) {
      res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
      return;
    }
    const rawText = typeof req.body?.rawText === 'string' ? req.body.rawText : '';
    const overrides =
      req.body?.draft && typeof req.body.draft === 'object'
        ? (req.body.draft as Record<string, unknown>)
        : {};

    const inquiry = await commitQuickPasteIntake({
      tenantId,
      userId: user.userId,
      userRole: user.role as UserRole,
      rawText,
      overrides,
    });
    res.status(201).json({ inquiry });
  } catch (e) {
    const coinErr = mapTenantCoinError(e);
    if (coinErr) {
      res.status(coinErr.status).json({ error: coinErr.message });
      return;
    }
    if (e instanceof QuickPasteValidationError) {
      res.status(400).json({ error: e.message, missingFields: e.missingFields ?? [] });
      return;
    }
    console.error('[quick-paste] commit', e);
    res.status(500).json({ error: '등록에 실패했습니다.' });
  }
});

export default router;
