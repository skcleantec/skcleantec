import { Router } from 'express';
import { authMiddleware, adminRoleOnly, type AuthPayload } from '../auth/auth.middleware.js';
import { requireTenantIdFromAuth } from './tenantScope.helpers.js';
import { getTenantConfig, updateTenantConfig } from './tenantConfig.service.js';
import { isMarketerAdminAccessEnabled } from '../../lib/staffAccess.js';

const router = Router();

router.use(authMiddleware);

/** 테넌트 마케터 관리자 권한 설정 조회 — ADMIN·MARKETER */
router.get('/', async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  if (auth.role !== 'ADMIN' && auth.role !== 'MARKETER') {
    res.status(403).json({ error: '권한이 필요합니다.' });
    return;
  }
  const tenantId = await requireTenantIdFromAuth(res, auth);
  if (!tenantId) return;
  const config = await getTenantConfig(tenantId);
  res.json({ marketerAdminAccess: isMarketerAdminAccessEnabled(config) });
});

/** 마케터 관리자 권한 설정 변경 — ADMIN 계정만 */
router.patch('/', adminRoleOnly, async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;
  const body = req.body as { marketerAdminAccess?: unknown };
  if (typeof body.marketerAdminAccess !== 'boolean') {
    res.status(400).json({ error: 'marketerAdminAccess(boolean)가 필요합니다.' });
    return;
  }
  const existing = await getTenantConfig(tenantId);
  const updated = await updateTenantConfig(tenantId, {
    access: { ...existing.access, marketerAdminAccess: body.marketerAdminAccess },
  });
  res.json({ marketerAdminAccess: isMarketerAdminAccessEnabled(updated) });
});

export default router;
