import { Router } from 'express';
import type { TenantPlanUpgradeRequestStatus } from '@prisma/client';
import { platformAuthMiddleware, platformSuperAdminOnly } from './platformAuth.middleware.js';
import {
  approveTenantPlanUpgradeRequest,
  listPlanUpgradeRequestsForPlatform,
  rejectTenantPlanUpgradeRequest,
  TenantPlanUpgradeRequestError,
} from './tenantPlanUpgradeRequest.service.js';

const router = Router();

router.use(platformAuthMiddleware);

/** GET /api/platform/plan-upgrade-requests?status=PENDING */
router.get('/', async (req, res) => {
  const statusRaw = typeof req.query.status === 'string' ? req.query.status : undefined;
  const status =
    statusRaw === 'PENDING' ||
    statusRaw === 'APPROVED' ||
    statusRaw === 'REJECTED' ||
    statusRaw === 'CANCELLED'
      ? (statusRaw as TenantPlanUpgradeRequestStatus)
      : undefined;
  try {
    const data = await listPlanUpgradeRequestsForPlatform(status);
    res.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '조회에 실패했습니다.';
    res.status(400).json({ error: msg });
  }
});

router.post('/:id/approve', platformSuperAdminOnly, async (req, res) => {
  const auth = req as unknown as { platformUser: { platformUserId: string } };
  const body = req.body as { adminNote?: string };
  try {
    const result = await approveTenantPlanUpgradeRequest({
      requestId: req.params.id,
      platformUserId: auth.platformUser.platformUserId,
      adminNote: body.adminNote,
    });
    res.json(result);
  } catch (e) {
    if (e instanceof TenantPlanUpgradeRequestError) {
      res.status(e.statusCode).json({ error: e.message });
      return;
    }
    const msg = e instanceof Error ? e.message : '승인에 실패했습니다.';
    res.status(400).json({ error: msg });
  }
});

router.post('/:id/reject', platformSuperAdminOnly, async (req, res) => {
  const auth = req as unknown as { platformUser: { platformUserId: string } };
  const body = req.body as { adminNote?: string };
  try {
    const result = await rejectTenantPlanUpgradeRequest({
      requestId: req.params.id,
      platformUserId: auth.platformUser.platformUserId,
      adminNote: body.adminNote,
    });
    res.json(result);
  } catch (e) {
    if (e instanceof TenantPlanUpgradeRequestError) {
      res.status(e.statusCode).json({ error: e.message });
      return;
    }
    const msg = e instanceof Error ? e.message : '반려에 실패했습니다.';
    res.status(400).json({ error: msg });
  }
});

export default router;
