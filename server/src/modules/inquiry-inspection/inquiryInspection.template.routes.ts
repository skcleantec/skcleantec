import { Router } from 'express';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { requireStaffPermission } from '../auth/marketerPermission.middleware.js';
import { requireFeature } from '../tenants/requireTenantFeature.js';
import { requireTenantIdFromAuth } from '../tenants/tenantScope.helpers.js';
import {
  getInspectionTemplateForTenant,
  resetInspectionTemplateForTenant,
  saveInspectionTemplateForTenant,
} from './inquiryInspection.template.service.js';

const router = Router();

router.use(authMiddleware, requireStaffPermission('admin.inspectionTemplate'), requireFeature('mod_inspection'));

router.get('/', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;
  try {
    const dto = await getInspectionTemplateForTenant(tenantId);
    res.json(dto);
  } catch (e) {
    console.error('[inspection-template] GET', e);
    res.status(500).json({ error: '템플릿을 불러오지 못했습니다.' });
  }
});

router.put('/', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;
  const body = req.body as { effective?: unknown };
  if (!body.effective || typeof body.effective !== 'object' || Array.isArray(body.effective)) {
    res.status(400).json({ error: 'effective 객체가 필요합니다.' });
    return;
  }
  try {
    const dto = await saveInspectionTemplateForTenant(
      tenantId,
      body.effective as Record<string, Array<{ itemKey: string; label: string }>>,
    );
    res.json(dto);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '저장에 실패했습니다.';
    res.status(400).json({ error: msg });
  }
});

router.post('/reset', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;
  try {
    const dto = await resetInspectionTemplateForTenant(tenantId);
    res.json(dto);
  } catch (e) {
    console.error('[inspection-template] reset', e);
    res.status(500).json({ error: '초기화에 실패했습니다.' });
  }
});

export default router;
