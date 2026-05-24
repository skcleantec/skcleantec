import { Router } from 'express';
import { authMiddleware } from '../../auth/auth.middleware.js';
import { requireTenantAuth, type TenantScopedRequest } from '../../tenants/tenant.middleware.js';
import { requireFeature } from '../../tenants/requireTenantFeature.js';

/**
 * L3 커스텀 라우트 템플릿 — `{slug}/routes.ts` 로 복사 후 수정
 *
 * 1. `customModuleCatalog.ts`에 moduleId 등록
 * 2. `index.ts` mountCustomModuleRoutes 에 router 등록
 * 3. moduleId·경로를 업체에 맞게 변경
 */
const router = Router();

router.get(
  '/example',
  authMiddleware,
  requireTenantAuth,
  requireFeature('custom_TEMPLATE_SLUG_example' as never),
  async (req, res) => {
    const { tenantId } = req as TenantScopedRequest;
    res.json({ ok: true, tenantId, message: 'custom module template' });
  },
);

export default router;
