import { Router } from 'express';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { getTenantIdFromAuth } from '../tenants/tenant.middleware.js';
import { resolveInquiryNaviDestination } from './inquiryNaviDestination.service.js';

const router = Router();

/** 관리자·마케터 — 우리 업체 접수 현장 좌표 (배정 불필요) */
router.post('/:id/navi-destination', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = getTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const result = await resolveInquiryNaviDestination({
    tenantId,
    inquiryId: req.params.id,
  });
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.json(result.data);
});

export default router;
