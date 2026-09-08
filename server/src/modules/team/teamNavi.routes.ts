import { Router } from 'express';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { resolveTenantIdFromAuth } from '../tenants/tenant.middleware.js';
import { resolveTeamNaviDestination } from './teamNaviDestination.service.js';

const router = Router();

/** 팀장 담당 접수 → 현장 좌표 (카카오내비·TMAP) */
router.post('/inquiries/:id/navi-destination', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await resolveTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const result = await resolveTeamNaviDestination({
    tenantId,
    userId: user.userId,
    inquiryId: req.params.id,
  });
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.json(result.data);
});

export default router;
