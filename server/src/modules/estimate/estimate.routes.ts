import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { requireStaffPermission } from '../auth/marketerPermission.middleware.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { getTenantIdFromAuth } from '../tenants/tenant.middleware.js';
import { getOrCreateEstimateConfig } from '../tenants/tenantConfigSeed.service.js';

const router = Router();
router.use(authMiddleware);

function requireTenant(req: import('express').Request, res: import('express').Response): string | null {
  const tenantId = getTenantIdFromAuth((req as unknown as { user: AuthPayload }).user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return null;
  }
  return tenantId;
}

/** Read estimate defaults (order form UI, telecrm settings) */
router.get('/config', requireStaffPermission('inquiry.view', 'orderform.issue', 'orderform.formConfig', 'crm.settings'), async (req, res) => {
  const tenantId = requireTenant(req, res);
  if (!tenantId) return;
  const config = await getOrCreateEstimateConfig(prisma, tenantId);
  res.json(config);
});

router.put('/config', requireStaffPermission('orderform.formConfig', 'crm.settings'), async (req, res) => {
  const tenantId = requireTenant(req, res);
  if (!tenantId) return;
  const { pricePerPyeong, depositAmount, minimumTotalAmount } = req.body as {
    pricePerPyeong?: number;
    depositAmount?: number;
    minimumTotalAmount?: number;
  };
  const existing = await getOrCreateEstimateConfig(prisma, tenantId);
  const config = await prisma.estimateConfig.update({
    where: { id: existing.id },
    data: {
      ...(pricePerPyeong != null && { pricePerPyeong }),
      ...(depositAmount != null && { depositAmount }),
      ...(minimumTotalAmount != null && { minimumTotalAmount: Math.max(0, minimumTotalAmount) }),
    },
  });
  res.json(config);
});

/** Active add-on options only */
router.get('/options', requireStaffPermission('inquiry.view', 'orderform.issue', 'orderform.formConfig'), async (req, res) => {
  const tenantId = requireTenant(req, res);
  if (!tenantId) return;
  const list = await prisma.estimateOption.findMany({
    where: { tenantId, isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
  res.json({ items: list });
});

/** All add-on options including inactive */
router.get('/options/all', requireStaffPermission('orderform.formConfig'), async (req, res) => {
  const tenantId = requireTenant(req, res);
  if (!tenantId) return;
  const list = await prisma.estimateOption.findMany({
    where: { tenantId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  res.json({ items: list });
});

router.post('/options', requireStaffPermission('orderform.formConfig'), async (req, res) => {
  const tenantId = requireTenant(req, res);
  if (!tenantId) return;
  const { name, extraAmount, sortOrder } = req.body as {
    name: string;
    extraAmount?: number;
    sortOrder?: number;
  };
  if (!name || name.trim() === '') {
    res.status(400).json({ error: '옵션명을 입력해주세요.' });
    return;
  }
  const created = await prisma.estimateOption.create({
    data: {
      tenantId,
      name: name.trim(),
      extraAmount: extraAmount ?? 0,
      sortOrder: sortOrder ?? 0,
    },
  });
  res.json(created);
});

router.patch('/options/:id', requireStaffPermission('orderform.formConfig'), async (req, res) => {
  const tenantId = requireTenant(req, res);
  if (!tenantId) return;
  const { id } = req.params;
  const { name, extraAmount, sortOrder, isActive } = req.body as {
    name?: string;
    extraAmount?: number;
    sortOrder?: number;
    isActive?: boolean;
  };
  const existing = await prisma.estimateOption.findFirst({ where: { id, tenantId } });
  if (!existing) {
    res.status(404).json({ error: '옵션을 찾을 수 없습니다.' });
    return;
  }
  const updated = await prisma.estimateOption.update({
    where: { id },
    data: {
      ...(name != null && { name }),
      ...(extraAmount != null && { extraAmount }),
      ...(sortOrder != null && { sortOrder }),
      ...(typeof isActive === 'boolean' && { isActive }),
    },
  });
  res.json(updated);
});

router.delete('/options/:id', requireStaffPermission('orderform.formConfig'), async (req, res) => {
  const tenantId = requireTenant(req, res);
  if (!tenantId) return;
  const { id } = req.params;
  const existing = await prisma.estimateOption.findFirst({ where: { id, tenantId } });
  if (!existing) {
    res.status(404).json({ error: '옵션을 찾을 수 없습니다.' });
    return;
  }
  await prisma.estimateOption.update({
    where: { id },
    data: { isActive: false },
  });
  res.json({ ok: true });
});

export default router;
