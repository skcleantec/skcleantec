import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { requireStaffPermission } from '../auth/marketerPermission.middleware.js';
import { requireFeature } from '../tenants/requireTenantFeature.js';
import { getTenantIdFromAuth } from '../tenants/tenant.middleware.js';
import { landingContactCreatedAtRangeFromQuery } from './landingContactListDateRange.js';
import {
  serializeLandingContactFormConfig,
  serializeLandingContactInquiries,
  serializeLandingContactInquiry,
} from './landingContact.serialize.js';
import {
  getOrCreateLandingContactFormConfig,
} from './landingContact.resolve.service.js';
import {
  parseLandingContactCustomFields,
} from './landingContactForm.schema.js';
import { convertLandingContactToInquiry } from './landingContact.convert.service.js';
import { InquiryCreateError } from '../inquiries/inquiryCreate.service.js';
import { LANDING_CONTACT_INQUIRY_STATUSES } from './landingContactForm.schema.js';
import type { UserRole } from '@prisma/client';

const router = Router();

router.use(authMiddleware, requireFeature('mod_landing_inquiry'));

const inquiryInclude = {
  operatingCompany: { select: { id: true, name: true, slug: true, isActive: true, config: true } },
  assignedTo: { select: { id: true, name: true, role: true } },
  convertedBy: { select: { id: true, name: true, role: true } },
  inquiry: { select: { id: true, inquiryNumber: true, status: true } },
} as const;

/** 브랜드별 폼 설정 목록 + 링크용 slug */
router.get('/form-configs', requireStaffPermission('leads.view'), async (req, res) => {
  const tenantId = getTenantIdFromAuth((req as unknown as { user: AuthPayload }).user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const brands = await prisma.operatingCompany.findMany({
    where: { tenantId, isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, slug: true, isActive: true, config: true },
  });
  const configs = await Promise.all(
    brands.map(async (oc) => {
      const cfg = await getOrCreateLandingContactFormConfig(tenantId, oc.id);
      return prisma.landingContactFormConfig.findFirstOrThrow({
        where: { id: cfg.id },
        include: { operatingCompany: { select: { id: true, name: true, slug: true, isActive: true, config: true } } },
      });
    }),
  );
  res.json({ items: configs.map(serializeLandingContactFormConfig) });
});

router.patch('/form-configs/:operatingCompanyId', requireStaffPermission('leads.edit'), async (req, res) => {
  const tenantId = getTenantIdFromAuth((req as unknown as { user: AuthPayload }).user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const operatingCompanyId = String(req.params.operatingCompanyId ?? '').trim();
  if (!operatingCompanyId) {
    res.status(400).json({ error: '브랜드를 지정해 주세요.' });
    return;
  }
  const oc = await prisma.operatingCompany.findFirst({
    where: { id: operatingCompanyId, tenantId },
    select: { id: true },
  });
  if (!oc) {
    res.status(404).json({ error: '브랜드를 찾을 수 없습니다.' });
    return;
  }
  const body = req.body as {
    title?: unknown;
    introText?: unknown;
    customFields?: unknown;
    isActive?: unknown;
  };
  const data: Prisma.LandingContactFormConfigUpdateInput = {};
  if (body.title !== undefined) {
    const t = body.title == null ? null : String(body.title).trim();
    data.title = t ? t.slice(0, 200) : null;
  }
  if (body.introText !== undefined) {
    const t = body.introText == null ? null : String(body.introText).trim();
    data.introText = t ? t.slice(0, 4000) : null;
  }
  if (body.customFields !== undefined) {
    data.customFields = parseLandingContactCustomFields(body.customFields);
  }
  if (typeof body.isActive === 'boolean') {
    data.isActive = body.isActive;
  }
  await getOrCreateLandingContactFormConfig(tenantId, operatingCompanyId);
  const updated = await prisma.landingContactFormConfig.update({
    where: { tenantId_operatingCompanyId: { tenantId, operatingCompanyId } },
    data,
    include: {
      operatingCompany: { select: { id: true, name: true, slug: true, isActive: true, config: true } },
    },
  });
  res.json(serializeLandingContactFormConfig(updated));
});

/** 문의 목록 */
router.get('/', requireStaffPermission('leads.view'), async (req, res) => {
  const tenantId = getTenantIdFromAuth((req as unknown as { user: AuthPayload }).user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const q = req.query as Record<string, string | undefined>;
  const range = landingContactCreatedAtRangeFromQuery({
    datePreset: q.datePreset,
    month: q.month,
    day: q.day,
  });
  const where: Prisma.LandingContactInquiryWhereInput = {
    tenantId,
    createdAt: { gte: range.gte, lte: range.lte },
  };
  const ocId = q.operatingCompanyId?.trim();
  if (ocId) where.operatingCompanyId = ocId;
  const status = q.status?.trim();
  if (status && (LANDING_CONTACT_INQUIRY_STATUSES as readonly string[]).includes(status)) {
    where.status = status;
  }
  const parsedLimit = Number.parseInt(String(q.limit ?? '30'), 10);
  const parsedOffset = Number.parseInt(String(q.offset ?? '0'), 10);
  const take = Number.isFinite(parsedLimit) ? Math.min(100, Math.max(1, parsedLimit)) : 30;
  const skip = Number.isFinite(parsedOffset) ? Math.max(0, parsedOffset) : 0;

  const [total, items] = await Promise.all([
    prisma.landingContactInquiry.count({ where }),
    prisma.landingContactInquiry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take,
      skip,
      include: inquiryInclude,
    }),
  ]);
  res.json({ items: serializeLandingContactInquiries(items), total });
});

router.get('/pending-count', requireStaffPermission('leads.view'), async (req, res) => {
  const tenantId = getTenantIdFromAuth((req as unknown as { user: AuthPayload }).user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const count = await prisma.landingContactInquiry.count({ where: { tenantId, status: 'NEW' } });
  res.json({ count });
});

router.get('/:id', requireStaffPermission('leads.view'), async (req, res) => {
  const tenantId = getTenantIdFromAuth((req as unknown as { user: AuthPayload }).user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const row = await prisma.landingContactInquiry.findFirst({
    where: { id: req.params.id, tenantId },
    include: inquiryInclude,
  });
  if (!row) {
    res.status(404).json({ error: '문의를 찾을 수 없습니다.' });
    return;
  }
  res.json(serializeLandingContactInquiry(row));
});

router.patch('/:id', requireStaffPermission('leads.edit'), async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = getTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const row = await prisma.landingContactInquiry.findFirst({
    where: { id: req.params.id, tenantId },
    select: { id: true, status: true, inquiryId: true },
  });
  if (!row) {
    res.status(404).json({ error: '문의를 찾을 수 없습니다.' });
    return;
  }
  const body = req.body as { status?: unknown; memo?: unknown };
  const data: Prisma.LandingContactInquiryUpdateInput = {};
  if (body.status !== undefined) {
    const s = String(body.status).trim();
    if (!(LANDING_CONTACT_INQUIRY_STATUSES as readonly string[]).includes(s)) {
      res.status(400).json({ error: '상태 값이 올바르지 않습니다.' });
      return;
    }
    if (row.inquiryId && s !== 'CONVERTED') {
      res.status(400).json({ error: '접수 전환된 문의는 CONVERTED 상태만 유지할 수 있습니다.' });
      return;
    }
    data.status = s;
  }
  if (body.memo !== undefined) {
    const m = body.memo == null ? null : String(body.memo).trim();
    data.memo = m ? m.slice(0, 8000) : null;
  }
  const updated = await prisma.landingContactInquiry.update({
    where: { id: row.id },
    data,
    include: inquiryInclude,
  });
  res.json(serializeLandingContactInquiry(updated));
});

router.post('/:id/convert', requireStaffPermission('leads.edit'), async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = getTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  try {
    const result = await convertLandingContactToInquiry({
      tenantId,
      landingContactId: req.params.id,
      userId: user.userId,
      userRole: user.role as UserRole,
    });
    const row = await prisma.landingContactInquiry.findFirstOrThrow({
      where: { id: req.params.id, tenantId },
      include: inquiryInclude,
    });
    res.json({ inquiryId: result.inquiryId, item: serializeLandingContactInquiry(row) });
  } catch (e) {
    if (e instanceof InquiryCreateError) {
      res.status(e.statusCode).json({ error: e.message });
      return;
    }
    throw e;
  }
});

export default router;
