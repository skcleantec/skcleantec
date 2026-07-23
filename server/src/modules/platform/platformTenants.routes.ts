import { Router } from 'express';
import type { TenantStatus } from '@prisma/client';
import { platformAuthMiddleware, platformSuperAdminOnly } from './platformAuth.middleware.js';
import {
  createTenantAdminForPlatform,
  listTenantAdminsForPlatform,
  updateTenantAdminForPlatform,
} from './tenantAdmins.service.js';
import {
  getTenantDetailForPlatform,
  listTenantsForPlatform,
  provisionTenant,
  replaceTenantFeatureOverrides,
  resetTenantFeaturesFromPlan,
  updateTenantBasics,
  updateTenantConfigForPlatform,
} from './tenantProvisioning.service.js';
import {
  getTelecrmPolicyForPlatform,
  listCrmEligibleUsersForTenant,
  saveTelecrmPolicyForPlatform,
} from '../telecrm/telecrmTenantPolicy.service.js';
import { TenantNotFoundError } from '../tenants/tenant.service.js';

const router = Router();

function isDbSchemaMismatchError(e: unknown): boolean {
  const s = e instanceof Error ? e.message : String(e);
  return /does not exist in the current database|Unknown column|P2022|column `.+\.tenant_id`/i.test(s);
}

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
      adminLoginId?: string;
      /** @deprecated adminLoginId 사용 */
      adminEmail?: string;
      adminPassword?: string;
      adminName?: string;
      status?: TenantStatus;
    };
    const result = await provisionTenant({
      slug: String(body.slug ?? ''),
      name: String(body.name ?? ''),
      plan: String(body.plan ?? 'starter'),
      adminLoginId: String(body.adminLoginId ?? body.adminEmail ?? ''),
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
      admin: {
        id: result.admin.id,
        loginId: result.admin.email,
        name: result.admin.name,
      },
    });
  } catch (e) {
    if (isDbSchemaMismatchError(e)) {
      res.status(503).json({
        error:
          'DB 스키마가 코드와 맞지 않습니다. 스테이징/운영 서버에서 prisma migrate deploy(또는 railway-predeploy-migrate)를 실행한 뒤 다시 시도해 주세요.',
      });
      return;
    }
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
    const body = req.body as {
      slug?: string;
      name?: string;
      plan?: string;
      status?: TenantStatus;
    };
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

router.patch('/:id/owner', platformSuperAdminOnly, async (req, res) => {
  try {
    const admins = await listTenantAdminsForPlatform(req.params.id);
    const primary = admins[0];
    if (!primary) {
      res.status(400).json({ error: '관리자 계정을 찾을 수 없습니다.' });
      return;
    }
    const body = req.body as { loginId?: string; password?: string; name?: string };
    const admin = await updateTenantAdminForPlatform(req.params.id, primary.id, body);
    res.json({ owner: admin, admin });
  } catch (e) {
    if (e instanceof TenantNotFoundError) {
      res.status(404).json({ error: e.message });
      return;
    }
    const msg = e instanceof Error ? e.message : '관리자 저장에 실패했습니다.';
    res.status(400).json({ error: msg });
  }
});

router.get('/:id/admins', async (req, res) => {
  try {
    const items = await listTenantAdminsForPlatform(req.params.id);
    res.json({ items });
  } catch (e) {
    if (e instanceof TenantNotFoundError) {
      res.status(404).json({ error: e.message });
      return;
    }
    throw e;
  }
});

router.post('/:id/admins', platformSuperAdminOnly, async (req, res) => {
  try {
    const body = req.body as {
      loginId?: string;
      password?: string;
      name?: string;
      isTenantOwner?: boolean;
    };
    const admin = await createTenantAdminForPlatform(req.params.id, {
      loginId: String(body.loginId ?? ''),
      password: String(body.password ?? ''),
      name: body.name,
      isTenantOwner: body.isTenantOwner,
    });
    res.status(201).json({ admin });
  } catch (e) {
    if (e instanceof TenantNotFoundError) {
      res.status(404).json({ error: e.message });
      return;
    }
    const msg = e instanceof Error ? e.message : '관리자 추가에 실패했습니다.';
    res.status(400).json({ error: msg });
  }
});

router.patch('/:id/admins/:adminId', platformSuperAdminOnly, async (req, res) => {
  try {
    const body = req.body as {
      loginId?: string;
      password?: string;
      name?: string;
      isActive?: boolean;
      isTenantOwner?: boolean;
    };
    const admin = await updateTenantAdminForPlatform(req.params.id, req.params.adminId, body);
    res.json({ admin });
  } catch (e) {
    if (e instanceof TenantNotFoundError) {
      res.status(404).json({ error: e.message });
      return;
    }
    const msg = e instanceof Error ? e.message : '관리자 저장에 실패했습니다.';
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

router.get('/:id/crm-eligible-users', async (req, res) => {
  try {
    const items = await listCrmEligibleUsersForTenant(req.params.id);
    res.json({ items });
  } catch (e) {
    if (e instanceof TenantNotFoundError) {
      res.status(404).json({ error: e.message });
      return;
    }
    throw e;
  }
});

router.get('/:id/telecrm-policy', async (req, res) => {
  try {
    const policy = await getTelecrmPolicyForPlatform(req.params.id);
    res.json(policy);
  } catch (e) {
    if (e instanceof TenantNotFoundError) {
      res.status(404).json({ error: e.message });
      return;
    }
    throw e;
  }
});

router.patch('/:id/telecrm-policy', platformSuperAdminOnly, async (req, res) => {
  try {
    const body = req.body as {
      licensed?: boolean;
      includedSeats?: number;
      additionalSeats?: number;
      allowedUserIds?: string[];
      platforms?: ('soomgo' | 'miso')[];
    };
    if (typeof body.licensed !== 'boolean') {
      res.status(400).json({ error: 'licensed(boolean)가 필요합니다.' });
      return;
    }
    const policy = await saveTelecrmPolicyForPlatform(req.params.id, {
      licensed: body.licensed,
      includedSeats: body.includedSeats,
      additionalSeats: body.additionalSeats,
      allowedUserIds: body.allowedUserIds,
      platforms: body.platforms,
    });
    res.json(policy);
  } catch (e) {
    if (e instanceof TenantNotFoundError) {
      res.status(404).json({ error: e.message });
      return;
    }
    const msg = e instanceof Error ? e.message : 'CRM 정책 저장에 실패했습니다.';
    res.status(400).json({ error: msg });
  }
});

export default router;
