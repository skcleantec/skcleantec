import { Router } from 'express';
import { authMiddleware, type AuthPayload } from '../auth/auth.middleware.js';
import { requireStaffPermission } from '../auth/marketerPermission.middleware.js';
import { requireTenantIdFromAuth } from '../tenants/tenantScope.helpers.js';
import {
  ackAllScheduleAlerts,
  ackScheduleAlert,
  countPendingScheduleAlerts,
  listPendingScheduleAlerts,
} from './scheduleAlerts.service.js';

const router = Router();

router.use(authMiddleware);
router.use(requireStaffPermission('inquiry.changeLog.view'));

router.get('/unseen-count', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  const count = await countPendingScheduleAlerts({
    tenantId,
    userId: user.userId,
    teamLeaderOnly: false,
  });
  res.json({ count });
});

router.get('/pending', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '50'), 10) || 50));
  const result = await listPendingScheduleAlerts({
    tenantId,
    userId: user.userId,
    teamLeaderOnly: false,
    limit,
  });
  res.json(result);
});

router.post('/ack-all', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  const acked = await ackAllScheduleAlerts({
    tenantId,
    userId: user.userId,
    teamLeaderOnly: false,
  });
  res.json({ ok: true, acked });
});

router.post('/:changeLogId/ack', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, user);
  if (!tenantId) return;
  const ok = await ackScheduleAlert({
    tenantId,
    userId: user.userId,
    changeLogId: String(req.params.changeLogId),
    teamLeaderOnly: false,
  });
  if (!ok) {
    res.status(404).json({ error: '알림을 찾을 수 없습니다.' });
    return;
  }
  res.json({ ok: true });
});

export default router;
