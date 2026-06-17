import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import {
  authMiddleware,
  adminOnly,
  adminOrMarketer,
  type AuthPayload,
} from '../auth/auth.middleware.js';
import { getTenantIdFromAuth } from '../tenants/tenant.middleware.js';
import { getTenantCompanyProfile } from '../tenants/tenantCompanyProfile.service.js';
import { createdAtRangeFromQuery } from '../inquiries/inquiryListDateRange.js';
import { allocateNextQuotationNumber } from './quotationNumber.js';
import { buildQuotationPdfBuffer } from './quotation.pdf.service.js';
import { sendQuotationEmail } from './quotation.email.service.js';
import {
  getOrCreateQuotationConfig,
  kstYmdPlusDays,
  serializeQuotationConfig,
} from './quotationConfig.service.js';
import {
  computeLineAmount,
  computeQuotationTotals,
  parseOptionalYmd,
  parseQuotationLineInputs,
  quotationInclude,
  serializeQuotation,
  serializeServiceItem,
  verifyActorPassword,
} from './quotations.service.js';

const router = Router();
router.use(authMiddleware);
router.use(adminOrMarketer);

function requireTenant(req: import('express').Request, res: import('express').Response): string | null {
  const tenantId = getTenantIdFromAuth((req as unknown as { user: AuthPayload }).user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return null;
  }
  return tenantId;
}

async function requireActorPassword(
  res: import('express').Response,
  userId: string,
  tenantId: string,
  password: unknown,
): Promise<boolean> {
  const raw = typeof password === 'string' ? password : '';
  if (!raw.trim()) {
    res.status(400).json({ error: '비밀번호를 입력해주세요.' });
    return false;
  }
  const actor = await prisma.user.findFirst({
    where: { id: userId, tenantId },
    select: { passwordHash: true },
  });
  if (!actor) {
    res.status(403).json({ error: '세션이 유효하지 않습니다.' });
    return false;
  }
  const ok = await verifyActorPassword(actor.passwordHash, raw, bcrypt.compare);
  if (!ok) {
    res.status(400).json({ error: '비밀번호가 일치하지 않습니다.' });
    return false;
  }
  return true;
}

async function loadPdfFooterNotice(tenantId: string): Promise<string | null> {
  const config = await getOrCreateQuotationConfig(prisma, tenantId);
  return config.footerNotice?.trim() || null;
}

/** 견적 서식·기본값 */
router.get('/config', async (req, res) => {
  const tenantId = requireTenant(req, res);
  if (!tenantId) return;
  const config = await getOrCreateQuotationConfig(prisma, tenantId);
  res.json(serializeQuotationConfig(config));
});

router.put('/config', adminOnly, async (req, res) => {
  const tenantId = requireTenant(req, res);
  if (!tenantId) return;
  const body = req.body as {
    footerNotice?: string | null;
    defaultValidDays?: number | null;
  };
  const existing = await getOrCreateQuotationConfig(prisma, tenantId);
  const patch: import('@prisma/client').Prisma.QuotationConfigUpdateInput = {};
  if (body.footerNotice !== undefined) {
    patch.footerNotice =
      typeof body.footerNotice === 'string' && body.footerNotice.trim()
        ? body.footerNotice.trim()
        : null;
  }
  if (body.defaultValidDays !== undefined) {
    if (body.defaultValidDays === null) {
      patch.defaultValidDays = null;
    } else if (
      typeof body.defaultValidDays === 'number' &&
      Number.isFinite(body.defaultValidDays)
    ) {
      patch.defaultValidDays = Math.max(0, Math.min(365, Math.round(body.defaultValidDays)));
    }
  }
  const updated = await prisma.quotationConfig.update({
    where: { id: existing.id },
    data: patch,
  });
  res.json(serializeQuotationConfig(updated));
});

/** 새 견적 작성 화면용 — 카탈로그·기본 유효기간 */
router.get('/editor-defaults', async (req, res) => {
  const tenantId = requireTenant(req, res);
  if (!tenantId) return;
  const [items, config] = await Promise.all([
    prisma.quotationServiceItem.findMany({
      where: { tenantId, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    }),
    getOrCreateQuotationConfig(prisma, tenantId),
  ]);
  const validUntilDefault =
    config.defaultValidDays != null && config.defaultValidDays > 0
      ? kstYmdPlusDays(config.defaultValidDays)
      : null;
  res.json({
    catalog: items.map(serializeServiceItem),
    config: serializeQuotationConfig(config),
    validUntilDefault,
  });
});

/** 견적 설정 — 서비스 항목 목록 (활성만) */
router.get('/service-items', async (req, res) => {
  const tenantId = requireTenant(req, res);
  if (!tenantId) return;
  const items = await prisma.quotationServiceItem.findMany({
    where: { tenantId, isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  res.json({ items: items.map(serializeServiceItem) });
});

/** 견적 설정 — 전체 목록 (비활성 포함) */
router.get('/service-items/all', async (req, res) => {
  const tenantId = requireTenant(req, res);
  if (!tenantId) return;
  const items = await prisma.quotationServiceItem.findMany({
    where: { tenantId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  res.json({ items: items.map(serializeServiceItem) });
});

router.post('/service-items', adminOnly, async (req, res) => {
  const tenantId = requireTenant(req, res);
  if (!tenantId) return;
  const body = req.body as {
    name?: string;
    unitPrice?: number;
    description?: string | null;
    sortOrder?: number;
  };
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    res.status(400).json({ error: '서비스명을 입력해주세요.' });
    return;
  }
  const unitPrice =
    typeof body.unitPrice === 'number' && Number.isFinite(body.unitPrice)
      ? Math.max(0, Math.round(body.unitPrice))
      : 0;
  const created = await prisma.quotationServiceItem.create({
    data: {
      tenantId,
      name,
      unitPrice,
      description:
        typeof body.description === 'string' && body.description.trim()
          ? body.description.trim()
          : null,
      sortOrder: typeof body.sortOrder === 'number' ? Math.round(body.sortOrder) : 0,
    },
  });
  res.json(serializeServiceItem(created));
});

router.patch('/service-items/:id', adminOnly, async (req, res) => {
  const tenantId = requireTenant(req, res);
  if (!tenantId) return;
  const { id } = req.params;
  const existing = await prisma.quotationServiceItem.findFirst({ where: { id, tenantId } });
  if (!existing) {
    res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
    return;
  }
  const body = req.body as Record<string, unknown>;
  const updated = await prisma.quotationServiceItem.update({
    where: { id },
    data: {
      ...(typeof body.name === 'string' && { name: body.name.trim() }),
      ...(typeof body.unitPrice === 'number' &&
        Number.isFinite(body.unitPrice) && { unitPrice: Math.max(0, Math.round(body.unitPrice)) }),
      ...(body.description !== undefined && {
        description:
          typeof body.description === 'string' && body.description.trim()
            ? body.description.trim()
            : null,
      }),
      ...(typeof body.sortOrder === 'number' && { sortOrder: Math.round(body.sortOrder) }),
      ...(typeof body.isActive === 'boolean' && { isActive: body.isActive }),
    },
  });
  res.json(serializeServiceItem(updated));
});

router.post('/service-items/:id/move', adminOnly, async (req, res) => {
  const tenantId = requireTenant(req, res);
  if (!tenantId) return;
  const { id } = req.params;
  const direction = (req.body as { direction?: string }).direction;
  if (direction !== 'up' && direction !== 'down') {
    res.status(400).json({ error: 'direction은 up 또는 down 이어야 합니다.' });
    return;
  }
  const items = await prisma.quotationServiceItem.findMany({
    where: { tenantId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  const idx = items.findIndex((r) => r.id === id);
  if (idx < 0) {
    res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
    return;
  }
  const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= items.length) {
    res.status(400).json({ error: '더 이상 이동할 수 없습니다.' });
    return;
  }
  const a = items[idx];
  const b = items[swapIdx];
  await prisma.$transaction([
    prisma.quotationServiceItem.update({ where: { id: a.id }, data: { sortOrder: b.sortOrder } }),
    prisma.quotationServiceItem.update({ where: { id: b.id }, data: { sortOrder: a.sortOrder } }),
  ]);
  const refreshed = await prisma.quotationServiceItem.findMany({
    where: { tenantId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  res.json({ items: refreshed.map(serializeServiceItem) });
});

router.delete('/service-items/:id', adminOnly, async (req, res) => {
  const tenantId = requireTenant(req, res);
  if (!tenantId) return;
  const auth = (req as unknown as { user: AuthPayload }).user;
  const body = (req.body ?? {}) as { password?: unknown };
  if (!(await requireActorPassword(res, auth.userId, tenantId, body.password))) return;

  const { id } = req.params;
  const existing = await prisma.quotationServiceItem.findFirst({ where: { id, tenantId } });
  if (!existing) {
    res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
    return;
  }
  await prisma.quotationServiceItem.delete({ where: { id } });
  res.json({ ok: true });
});

/** 견적서 목록 */
router.get('/', async (req, res) => {
  const tenantId = requireTenant(req, res);
  if (!tenantId) return;

  const parsedLimit = Number.parseInt(String(req.query.limit ?? '30'), 10);
  const parsedOffset = Number.parseInt(String(req.query.offset ?? '0'), 10);
  const take = Number.isFinite(parsedLimit) ? Math.min(100, Math.max(1, parsedLimit)) : 30;
  const skip = Number.isFinite(parsedOffset) ? Math.max(0, parsedOffset) : 0;

  const customerName =
    typeof req.query.customerName === 'string' ? req.query.customerName.trim() : '';
  const statusRaw = typeof req.query.status === 'string' ? req.query.status.trim() : '';
  const createdRange = createdAtRangeFromQuery({
    datePreset: typeof req.query.datePreset === 'string' ? req.query.datePreset : undefined,
    month: typeof req.query.month === 'string' ? req.query.month : undefined,
    day: typeof req.query.day === 'string' ? req.query.day : undefined,
  });

  const where: import('@prisma/client').Prisma.QuotationWhereInput = { tenantId };
  if (customerName) {
    where.customerName = { contains: customerName, mode: 'insensitive' };
  }
  if (statusRaw === 'DRAFT' || statusRaw === 'FINALIZED' || statusRaw === 'SENT') {
    where.status = statusRaw;
  }
  if (createdRange) {
    where.createdAt = { gte: createdRange.gte, lte: createdRange.lte };
  }

  const [total, rows] = await Promise.all([
    prisma.quotation.count({ where }),
    prisma.quotation.findMany({
      where,
      include: quotationInclude,
      orderBy: [{ createdAt: 'desc' }],
      take,
      skip,
    }),
  ]);
  res.json({ items: rows.map((r) => serializeQuotation(r)), total });
});

router.get('/:id', async (req, res) => {
  const tenantId = requireTenant(req, res);
  if (!tenantId) return;
  const row = await prisma.quotation.findFirst({
    where: { id: req.params.id, tenantId },
    include: quotationInclude,
  });
  if (!row) {
    res.status(404).json({ error: '견적서를 찾을 수 없습니다.' });
    return;
  }
  res.json(serializeQuotation(row));
});

router.post('/', async (req, res) => {
  const tenantId = requireTenant(req, res);
  if (!tenantId) return;
  const auth = (req as unknown as { user: AuthPayload }).user;
  const body = req.body as Record<string, unknown>;

  const customerName = typeof body.customerName === 'string' ? body.customerName.trim() : '';
  if (!customerName) {
    res.status(400).json({ error: '상대 이름을 입력해주세요.' });
    return;
  }

  const linesParsed = parseQuotationLineInputs(body.lineItems);
  if (linesParsed === 'INVALID') {
    res.status(400).json({ error: '견적 항목 형식이 올바르지 않습니다.' });
    return;
  }

  const validUntilParsed = parseOptionalYmd(body.validUntil);
  if (validUntilParsed === 'INVALID') {
    res.status(400).json({ error: '유효기간 날짜 형식이 올바르지 않습니다.' });
    return;
  }

  const discountAmount =
    typeof body.discountAmount === 'number' && Number.isFinite(body.discountAmount)
      ? Math.max(0, Math.round(body.discountAmount))
      : 0;
  const { subtotal, total } = computeQuotationTotals(linesParsed, discountAmount);

  const row = await prisma.$transaction(async (tx) => {
    const quoteNumber = await allocateNextQuotationNumber(tx, tenantId);
    return tx.quotation.create({
      data: {
        tenantId,
        quoteNumber,
        status: 'DRAFT',
        customerName,
        customerPhone:
          typeof body.customerPhone === 'string' && body.customerPhone.trim()
            ? body.customerPhone.trim()
            : null,
        customerEmail:
          typeof body.customerEmail === 'string' && body.customerEmail.trim()
            ? body.customerEmail.trim()
            : null,
        customerAddress:
          typeof body.customerAddress === 'string' && body.customerAddress.trim()
            ? body.customerAddress.trim()
            : null,
        memo: typeof body.memo === 'string' && body.memo.trim() ? body.memo.trim() : null,
        subtotal,
        discountAmount,
        total,
        validUntil: validUntilParsed,
        inquiryId:
          typeof body.inquiryId === 'string' && body.inquiryId.trim() ? body.inquiryId.trim() : null,
        createdById: auth.userId,
        lineItems: {
          create: linesParsed.map((li, i) => ({
            tenantId,
            catalogItemId: li.catalogItemId,
            label: li.label,
            unitPrice: li.unitPrice,
            quantity: li.quantity,
            lineAmount: computeLineAmount(li.unitPrice, li.quantity),
            sortOrder: li.sortOrder ?? i,
          })),
        },
      },
      include: quotationInclude,
    });
  });

  res.status(201).json(serializeQuotation(row));
});

router.patch('/:id', async (req, res) => {
  const tenantId = requireTenant(req, res);
  if (!tenantId) return;
  const { id } = req.params;
  const existing = await prisma.quotation.findFirst({ where: { id, tenantId } });
  if (!existing) {
    res.status(404).json({ error: '견적서를 찾을 수 없습니다.' });
    return;
  }

  const body = req.body as Record<string, unknown>;
  const customerName =
    typeof body.customerName === 'string' ? body.customerName.trim() : existing.customerName;
  if (!customerName) {
    res.status(400).json({ error: '상대 이름을 입력해주세요.' });
    return;
  }

  let linesParsed: import('./quotations.service.js').QuotationLineInput[];
  if (body.lineItems !== undefined) {
    const parsed = parseQuotationLineInputs(body.lineItems);
    if (parsed === 'INVALID') {
      res.status(400).json({ error: '견적 항목 형식이 올바르지 않습니다.' });
      return;
    }
    linesParsed = parsed;
  } else {
    const existingLines = await prisma.quotationLineItem.findMany({
      where: { quotationId: id },
      orderBy: [{ sortOrder: 'asc' }],
    });
    linesParsed = existingLines.map((li) => ({
      catalogItemId: li.catalogItemId,
      label: li.label,
      unitPrice: li.unitPrice,
      quantity: li.quantity,
      sortOrder: li.sortOrder,
    }));
  }

  const validUntilParsed =
    body.validUntil !== undefined ? parseOptionalYmd(body.validUntil) : existing.validUntil;
  if (validUntilParsed === 'INVALID') {
    res.status(400).json({ error: '유효기간 날짜 형식이 올바르지 않습니다.' });
    return;
  }

  const discountAmount =
    typeof body.discountAmount === 'number' && Number.isFinite(body.discountAmount)
      ? Math.max(0, Math.round(body.discountAmount))
      : existing.discountAmount;
  const { subtotal, total } = computeQuotationTotals(linesParsed, discountAmount);

  const statusRaw = body.status;
  const nextStatus =
    statusRaw === 'DRAFT' || statusRaw === 'FINALIZED' || statusRaw === 'SENT'
      ? statusRaw
      : existing.status;

  const row = await prisma.$transaction(async (tx) => {
    if (body.lineItems !== undefined) {
      await tx.quotationLineItem.deleteMany({ where: { quotationId: id } });
      if (linesParsed.length > 0) {
        await tx.quotationLineItem.createMany({
          data: linesParsed.map((li, i) => ({
            tenantId,
            quotationId: id,
            catalogItemId: li.catalogItemId,
            label: li.label,
            unitPrice: li.unitPrice,
            quantity: li.quantity,
            lineAmount: computeLineAmount(li.unitPrice, li.quantity),
            sortOrder: li.sortOrder ?? i,
          })),
        });
      }
    }

    return tx.quotation.update({
      where: { id },
      data: {
        customerName,
        customerPhone:
          body.customerPhone !== undefined
            ? typeof body.customerPhone === 'string' && body.customerPhone.trim()
              ? body.customerPhone.trim()
              : null
            : undefined,
        customerEmail:
          body.customerEmail !== undefined
            ? typeof body.customerEmail === 'string' && body.customerEmail.trim()
              ? body.customerEmail.trim()
              : null
            : undefined,
        customerAddress:
          body.customerAddress !== undefined
            ? typeof body.customerAddress === 'string' && body.customerAddress.trim()
              ? body.customerAddress.trim()
              : null
            : undefined,
        memo:
          body.memo !== undefined
            ? typeof body.memo === 'string' && body.memo.trim()
              ? body.memo.trim()
              : null
            : undefined,
        subtotal,
        discountAmount,
        total,
        validUntil: validUntilParsed,
        status: nextStatus,
        inquiryId:
          body.inquiryId !== undefined
            ? typeof body.inquiryId === 'string' && body.inquiryId.trim()
              ? body.inquiryId.trim()
              : null
            : undefined,
      },
      include: quotationInclude,
    });
  });

  res.json(serializeQuotation(row));
});

router.delete('/:id', async (req, res) => {
  const tenantId = requireTenant(req, res);
  if (!tenantId) return;
  const auth = (req as unknown as { user: AuthPayload }).user;
  const body = (req.body ?? {}) as { password?: unknown };
  if (!(await requireActorPassword(res, auth.userId, tenantId, body.password))) return;

  const { id } = req.params;
  const existing = await prisma.quotation.findFirst({ where: { id, tenantId } });
  if (!existing) {
    res.status(404).json({ error: '견적서를 찾을 수 없습니다.' });
    return;
  }
  await prisma.quotation.delete({ where: { id } });
  res.json({ ok: true });
});

router.get('/:id/pdf', async (req, res) => {
  const tenantId = requireTenant(req, res);
  if (!tenantId) return;
  const row = await prisma.quotation.findFirst({
    where: { id: req.params.id, tenantId },
    include: quotationInclude,
  });
  if (!row) {
    res.status(404).json({ error: '견적서를 찾을 수 없습니다.' });
    return;
  }
  const profile = await getTenantCompanyProfile(tenantId);
  const footerNotice = await loadPdfFooterNotice(tenantId);
  const buffer = await buildQuotationPdfBuffer(row, profile.companyRegistration, { footerNotice });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="quotation_${row.quoteNumber}.pdf"`,
  );
  res.send(buffer);
});

router.post('/:id/send-email', async (req, res) => {
  const tenantId = requireTenant(req, res);
  if (!tenantId) return;
  const row = await prisma.quotation.findFirst({
    where: { id: req.params.id, tenantId },
    include: quotationInclude,
  });
  if (!row) {
    res.status(404).json({ error: '견적서를 찾을 수 없습니다.' });
    return;
  }

  const body = req.body as { to?: string };
  const to =
    (typeof body.to === 'string' && body.to.trim()) ||
    row.customerEmail?.trim() ||
    '';
  if (!to) {
    res.status(400).json({ error: '수신 이메일을 입력해주세요.' });
    return;
  }

  const profile = await getTenantCompanyProfile(tenantId);
  const companyName = profile.companyRegistration.companyName?.trim() || '견적서';
  const footerNotice = await loadPdfFooterNotice(tenantId);
  const pdfBuffer = await buildQuotationPdfBuffer(row, profile.companyRegistration, {
    footerNotice,
  });

  const sent = await sendQuotationEmail({
    tenantId,
    quotation: row,
    to,
    pdfBuffer,
    companyName,
  });
  if (!sent) {
    res.status(503).json({ error: 'SMTP가 설정되지 않았습니다. 업체등록정보에서 메일 설정을 확인해주세요.' });
    return;
  }

  const updated = await prisma.quotation.update({
    where: { id: row.id },
    data: { status: 'SENT', sentAt: new Date(), customerEmail: to },
    include: quotationInclude,
  });
  res.json({ ok: true, quotation: serializeQuotation(updated) });
});

export default router;
