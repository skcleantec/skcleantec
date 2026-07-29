import { Router } from 'express';
import { authMiddleware, type AuthPayload } from '../auth/auth.middleware.js';
import { requireTenantIdFromAuth } from '../tenants/tenantScope.helpers.js';
import {
  cancelTenantPlanUpgradeRequest,
  createTenantPlanUpgradeRequest,
  getTenantPlanUpgradeRequestForAdmin,
  TenantPlanUpgradeRequestError,
} from '../platform/tenantPlanUpgradeRequest.service.js';

const router = Router();

router.use(authMiddleware);

/** GET /api/admin/tenant-plan-upgrade — 유료 전환 신청 현황 */
router.get('/', async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  if (auth.role !== 'ADMIN') {
    res.status(403).json({ error: '관리자만 조회할 수 있습니다.' });
    return;
  }
  const tenantId = await requireTenantIdFromAuth(res, auth);
  if (!tenantId) return;
  try {
    const data = await getTenantPlanUpgradeRequestForAdmin(tenantId);
    res.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '조회에 실패했습니다.';
    res.status(400).json({ error: msg });
  }
});

/** POST /api/admin/tenant-plan-upgrade — 유료 플랜 전환 신청 */
router.post('/', async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  if (auth.role !== 'ADMIN') {
    res.status(403).json({ error: '관리자만 신청할 수 있습니다.' });
    return;
  }
  const tenantId = await requireTenantIdFromAuth(res, auth);
  if (!tenantId) return;
  const body = req.body as { requestedPlan?: string; message?: string };
  try {
    const pending = await createTenantPlanUpgradeRequest({
      tenantId,
      requesterUserId: auth.userId,
      requestedPlan: String(body.requestedPlan ?? ''),
      message: body.message,
    });
    res.status(201).json({ pending });
  } catch (e) {
    if (e instanceof TenantPlanUpgradeRequestError) {
      res.status(e.statusCode).json({ error: e.message });
      return;
    }
    const msg = e instanceof Error ? e.message : '신청에 실패했습니다.';
    res.status(400).json({ error: msg });
  }
});

/** POST /api/admin/tenant-plan-upgrade/:id/cancel */
router.post('/:id/cancel', async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  if (auth.role !== 'ADMIN') {
    res.status(403).json({ error: '관리자만 취소할 수 있습니다.' });
    return;
  }
  const tenantId = await requireTenantIdFromAuth(res, auth);
  if (!tenantId) return;
  try {
    const result = await cancelTenantPlanUpgradeRequest(tenantId, req.params.id);
    res.json(result);
  } catch (e) {
    if (e instanceof TenantPlanUpgradeRequestError) {
      res.status(e.statusCode).json({ error: e.message });
      return;
    }
    const msg = e instanceof Error ? e.message : '취소에 실패했습니다.';
    res.status(400).json({ error: msg });
  }
});

export default router;
