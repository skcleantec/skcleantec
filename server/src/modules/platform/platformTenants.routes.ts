import { Router } from 'express';
import type { TenantStatus } from '@prisma/client';
import { platformAuthMiddleware, platformSuperAdminOnly } from './platformAuth.middleware.js';
import {
  getTenantDetailForPlatform,
  listTenantsForPlatform,
  provisionTenant,
  replaceTenantFeatureOverrides,
  resetTenantFeaturesFromPlan,
  updateTenantBasics,
  updateTenantConfigForPlatform,
} from './tenantProvisioning.service.js';
import { TenantNotFoundError } from '../tenants/tenant.service.js';

const router = Router();

router.use(platformAuthMiddleware);

router.get('/', async (_req, res) => {
  const items = await listTenantsForPlatform();
  res.json({ items });
});

router.post('/', platformSuperAdminOnly, async (req, res) => {
  try {
    const body = req.body as {
      slug?: string;
      name?: string;
      plan?: string;
      adminEmail?: string;
      adminPassword?: string;
      adminName?: string;
      status?: TenantStatus;
    };
    const result = await provisionTenant({
      slug: String(body.slug ?? ''),
      name: String(body.name ?? ''),
      plan: String(body.plan ?? 'starter'),
      adminEmail: String(body.adminEmail ?? 'admin'),
      adminPassword: String(body.adminPassword ?? ''),
      adminName: body.adminName,
      status: body.status,
    });
    res.status(201).json({
      tenant: {
        id: result.tenant.id,
        slug: result.tenant.slug,
        name: result.tenant.name,
        plan: result.tenant.plan,
        status: result.tenant.status,
      },
      admin: result.admin,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '업체 생성에 실패했습니다.';
    res.status(400).json({ error: msg });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const detail = await getTenantDetailForPlatform(req.params.id);
    res.json(detail);
  } catch (e) {
    if (e instanceof TenantNotFoundError) {
      res.status(404).json({ error: e.message });
      return;
    }
    throw e;
  }
});

router.patch('/:id', platformSuperAdminOnly, async (req, res) => {
  try {
    const body = req.body as { name?: string; plan?: string; status?: TenantStatus };
    const tenant = await updateTenantBasics(req.params.id, body);
    res.json({ tenant });
  } catch (e) {
    if (e instanceof TenantNotFoundError) {
      res.status(404).json({ error: e.message });
      return;
    }
    const msg = e instanceof Error ? e.message : '저장에 실패했습니다.';
    res.status(400).json({ error: msg });
  }
});

router.put('/:id/features', platformSuperAdminOnly, async (req, res) => {
  try {
    const body = req.body as { features?: { moduleId: string; enabled: boolean }[] };
    if (!Array.isArray(body.features)) {
      res.status(400).json({ error: 'features 배열이 필요합니다.' });
      return;
    }
    await replaceTenantFeatureOverrides(req.params.id, body.features);
    const detail = await getTenantDetailForPlatform(req.params.id);
    res.json(detail);
  } catch (e) {
    if (e instanceof TenantNotFoundError) {
      res.status(404).json({ error: e.message });
      return;
    }
    throw e;
  }
});

router.post('/:id/features/reset-from-plan', platformSuperAdminOnly, async (req, res) => {
  try {
    await resetTenantFeaturesFromPlan(req.params.id);
    const detail = await getTenantDetailForPlatform(req.params.id);
    res.json(detail);
  } catch (e) {
    if (e instanceof TenantNotFoundError) {
      res.status(404).json({ error: e.message });
      return;
    }
    throw e;
  }
});

router.patch('/:id/config', platformSuperAdminOnly, async (req, res) => {
  try {
    const config = await updateTenantConfigForPlatform(req.params.id, req.body);
    res.json({ config });
  } catch (e) {
    if (e instanceof TenantNotFoundError) {
      res.status(404).json({ error: e.message });
      return;
    }
    const msg = e instanceof Error ? e.message : '설정 저장에 실패했습니다.';
    res.status(400).json({ error: msg });
  }
});

export default router;
