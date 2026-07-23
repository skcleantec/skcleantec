import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { requireStaffPermission } from '../auth/marketerPermission.middleware.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { getTenantIdFromAuth } from '../tenants/tenant.middleware.js';
import {
  assertActiveLeadSourceLabel,
  mapLeadSourceValidationError,
  seedInquiryLeadSourceDefaultsForTenant,
  serializeInquiryLeadSourceOption,
} from './inquiryLeadSource.service.js';

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

const readPerm = requireStaffPermission(
  'inquiry.view',
  'orderform.issue',
  'orderform.formConfig',
  'crm.settings',
  'followup.view',
);

/** 드롭다운용 — 활성 유입경로만 */
router.get('/', readPerm, async (req, res) => {
  const tenantId = requireTenant(req, res);
  if (!tenantId) return;
  await seedInquiryLeadSourceDefaultsForTenant(prisma, tenantId);
  const list = await prisma.inquiryLeadSourceOption.findMany({
    where: { tenantId, isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  res.json({ items: list.map(serializeInquiryLeadSourceOption) });
});

/** 발주서 설정 — 전체(비활성 포함) */
router.get('/all', requireStaffPermission('orderform.formConfig'), async (req, res) => {
  const tenantId = requireTenant(req, res);
  if (!tenantId) return;
  await seedInquiryLeadSourceDefaultsForTenant(prisma, tenantId);
  const list = await prisma.inquiryLeadSourceOption.findMany({
    where: { tenantId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  res.json({ items: list.map(serializeInquiryLeadSourceOption) });
});

router.post('/', requireStaffPermission('orderform.formConfig'), async (req, res) => {
  const tenantId = requireTenant(req, res);
  if (!tenantId) return;
  const { label, sortOrder } = req.body as { label?: string; sortOrder?: number };
  const trimmed = typeof label === 'string' ? label.trim() : '';
  if (!trimmed) {
    res.status(400).json({ error: '플랫폼 이름을 입력해 주세요.' });
    return;
  }
  if (trimmed.length > 64) {
    res.status(400).json({ error: '플랫폼 이름은 64자 이내로 입력해 주세요.' });
    return;
  }
  const dup = await prisma.inquiryLeadSourceOption.findFirst({
    where: { tenantId, label: trimmed },
    select: { id: true },
  });
  if (dup) {
    res.status(400).json({ error: '같은 이름의 유입경로가 이미 있습니다.' });
    return;
  }
  let nextSort = sortOrder;
  if (nextSort == null || !Number.isFinite(nextSort)) {
    const max = await prisma.inquiryLeadSourceOption.aggregate({
      where: { tenantId },
      _max: { sortOrder: true },
    });
    nextSort = (max._max.sortOrder ?? -1) + 1;
  }
  const created = await prisma.inquiryLeadSourceOption.create({
    data: { tenantId, label: trimmed, sortOrder: Math.floor(nextSort), isActive: true },
  });
  res.json(serializeInquiryLeadSourceOption(created));
});

router.patch('/:id', requireStaffPermission('orderform.formConfig'), async (req, res) => {
  const tenantId = requireTenant(req, res);
  if (!tenantId) return;
  const { id } = req.params;
  const { label, sortOrder, isActive } = req.body as {
    label?: string;
    sortOrder?: number;
    isActive?: boolean;
  };
  const existing = await prisma.inquiryLeadSourceOption.findFirst({ where: { id, tenantId } });
  if (!existing) {
    res.status(404).json({ error: '유입경로를 찾을 수 없습니다.' });
    return;
  }
  let nextLabel = existing.label;
  if (label != null) {
    const trimmed = String(label).trim();
    if (!trimmed) {
      res.status(400).json({ error: '플랫폼 이름을 입력해 주세요.' });
      return;
    }
    if (trimmed.length > 64) {
      res.status(400).json({ error: '플랫폼 이름은 64자 이내로 입력해 주세요.' });
      return;
    }
    if (trimmed !== existing.label) {
      const dup = await prisma.inquiryLeadSourceOption.findFirst({
        where: { tenantId, label: trimmed, NOT: { id: existing.id } },
        select: { id: true },
      });
      if (dup) {
        res.status(400).json({ error: '같은 이름의 유입경로가 이미 있습니다.' });
        return;
      }
    }
    nextLabel = trimmed;
  }
  const updated = await prisma.inquiryLeadSourceOption.update({
    where: { id },
    data: {
      ...(label != null ? { label: nextLabel } : {}),
      ...(sortOrder != null && Number.isFinite(sortOrder) ? { sortOrder: Math.floor(sortOrder) } : {}),
      ...(typeof isActive === 'boolean' ? { isActive } : {}),
    },
  });
  res.json(serializeInquiryLeadSourceOption(updated));
});

router.delete('/:id', requireStaffPermission('orderform.formConfig'), async (req, res) => {
  const tenantId = requireTenant(req, res);
  if (!tenantId) return;
  const { id } = req.params;
  const existing = await prisma.inquiryLeadSourceOption.findFirst({ where: { id, tenantId } });
  if (!existing) {
    res.status(404).json({ error: '유입경로를 찾을 수 없습니다.' });
    return;
  }
  await prisma.inquiryLeadSourceOption.update({
    where: { id },
    data: { isActive: false },
  });
  res.json({ ok: true });
});

/** CRM·발급 저장 전 검증용(선택) */
router.post('/validate', readPerm, async (req, res) => {
  const tenantId = requireTenant(req, res);
  if (!tenantId) return;
  try {
    const label = await assertActiveLeadSourceLabel(prisma, tenantId, req.body?.label);
    res.json({ ok: true, label });
  } catch (e) {
    const mapped = mapLeadSourceValidationError(e);
    if (mapped) {
      res.status(mapped.status).json({ error: mapped.message });
      return;
    }
    throw e;
  }
});

export default router;
