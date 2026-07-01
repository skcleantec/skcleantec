import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware, type AuthPayload } from '../auth/auth.middleware.js';
import { requireStaffPermission, staffMarketerRoleOnly } from '../auth/marketerPermission.middleware.js';
import { requireTenantIdFromAuth } from '../tenants/tenantScope.helpers.js';
import {
  createOperatingCompany,
  listOperatingCompanies,
  listUserOperatingCompanies,
  OperatingCompanyNotFoundError,
  OperatingCompanyValidationError,
  updateOperatingCompany,
} from './operatingCompany.service.js';
import {
  getOperatingCompanyPolicyFromService,
  resolveOperatingCompanyPolicy,
} from './operatingCompanyPolicy.js';
import { userHasStaffAdminAccess } from '../auth/staffAdminAccess.service.js';
import { getTenantConfig, updateTenantConfig } from '../tenants/tenantConfig.service.js';
import type { OperatingCompanyPolicy } from './operatingCompanyPolicy.js';

const router = Router();

router.use(authMiddleware, staffMarketerRoleOnly);

router.get('/', async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, auth);
  if (!tenantId) return;
  const includeInactive = await userHasStaffAdminAccess(auth);
  const items = await listOperatingCompanies(prisma, tenantId, { includeInactive });
  res.json({ items });
});

router.get('/policy', requireStaffPermission('admin.users'), async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;
  const policy = await getOperatingCompanyPolicyFromService(tenantId);
  res.json({ policy });
});

router.patch('/policy', requireStaffPermission('admin.users'), async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;
  const body = req.body as { policy?: Partial<OperatingCompanyPolicy> };
  if (!body.policy || typeof body.policy !== 'object') {
    res.status(400).json({ error: 'policy 객체가 필요합니다.' });
    return;
  }
  const existing = await getTenantConfig(tenantId);
  const current = resolveOperatingCompanyPolicy({
    operatingCompanyPolicy: existing.operatingCompanyPolicy,
  });
  const mergedPolicy = { ...current, ...body.policy };
  const updated = await updateTenantConfig(tenantId, {
    operatingCompanyPolicy: mergedPolicy,
  });
  res.json({
    policy: resolveOperatingCompanyPolicy({
      operatingCompanyPolicy: updated.operatingCompanyPolicy,
    }),
  });
});

router.get('/my', async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, auth);
  if (!tenantId) return;
  const isStaffAdmin = await userHasStaffAdminAccess(auth);
  if (isStaffAdmin) {
    const items = await listOperatingCompanies(prisma, tenantId);
    res.json({
      items: items.map((oc) => ({ ...oc, isPrimary: oc.isDefault })),
      isAdmin: true,
    });
    return;
  }
  const items = await listUserOperatingCompanies(prisma, tenantId, auth.userId);
  res.json({ items, isAdmin: false });
});

router.post('/', requireStaffPermission('admin.users'), async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;
  try {
    const created = await createOperatingCompany(prisma, tenantId, req.body);
    res.status(201).json(created);
  } catch (e) {
    if (e instanceof OperatingCompanyValidationError) {
      res.status(400).json({ error: e.message });
      return;
    }
    throw e;
  }
});

router.patch('/:id', requireStaffPermission('admin.users'), async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;
  try {
    const updated = await updateOperatingCompany(prisma, tenantId, req.params.id, req.body);
    res.json(updated);
  } catch (e) {
    if (e instanceof OperatingCompanyNotFoundError) {
      res.status(404).json({ error: e.message });
      return;
    }
    if (e instanceof OperatingCompanyValidationError) {
      res.status(400).json({ error: e.message });
      return;
    }
    throw e;
  }
});

export default router;
