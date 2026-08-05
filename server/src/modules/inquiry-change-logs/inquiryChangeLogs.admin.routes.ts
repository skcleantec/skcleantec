import { Router } from 'express';
import { authMiddleware, adminRoleOnly, type AuthPayload } from '../auth/auth.middleware.js';
import { requireTenantIdFromAuth } from '../tenants/tenantScope.helpers.js';
import { fetchInquiryChangeLogListPage } from './inquiryChangeLogList.service.js';

const router = Router();

router.use(authMiddleware);
router.use(adminRoleOnly);

/** 관리자 전용 — 테넌트 전체 변경 이력 아카이브 (기간·검색·페이지) */
router.get('/', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;

  const { customerName, search, limit, offset, datePreset, month, day } = req.query;

  const result = await fetchInquiryChangeLogListPage(tenantId, {
    search: typeof search === 'string' ? search : undefined,
    customerName: typeof customerName === 'string' ? customerName : undefined,
    limit: limit != null ? parseInt(String(limit), 10) : undefined,
    offset: offset != null ? parseInt(String(offset), 10) : undefined,
    datePreset: typeof datePreset === 'string' ? datePreset : undefined,
    month: typeof month === 'string' ? month : undefined,
    day: typeof day === 'string' ? day : undefined,
  });

  res.json(result);
});

export default router;
