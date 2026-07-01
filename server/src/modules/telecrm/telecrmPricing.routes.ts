import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware, type AuthPayload } from '../auth/auth.middleware.js';
import { requireStaffPermission, staffMarketerRoleOnly } from '../auth/marketerPermission.middleware.js';
import { getOrCreateEstimateConfig } from '../tenants/tenantConfigSeed.service.js';
import {
  parseAmountWon,
  parseSortOrder,
  requireTelecrmActorPassword,
  requireTelecrmTenant,
} from './telecrm.helpers.js';
import { ensureTelecrmDefaults } from './telecrmSeed.service.js';

const categoriesRouter = Router();
categoriesRouter.use(authMiddleware, staffMarketerRoleOnly);

function serializeCategory(row: {
  id: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
  items?: {
    id: string;
    categoryId: string;
    name: string;
    amountWon: number;
    description: string | null;
    sortOrder: number;
    isActive: boolean;
  }[];
}) {
  return {
    id: row.id,
    label: row.label,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    items: row.items?.map(serializeItem) ?? undefined,
  };
}

function serializeItem(row: {
  id: string;
  categoryId: string;
  name: string;
  amountWon: number;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
}) {
  return {
    id: row.id,
    categoryId: row.categoryId,
    name: row.name,
    amountWon: row.amountWon,
    description: row.description,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
  };
}

categoriesRouter.get(
  '/',
  requireStaffPermission('crm.view', 'crm.settings'),
  async (req, res) => {
    const tenantId = requireTelecrmTenant(req, res);
    if (!tenantId) return;
    const includeInactive = req.query.includeInactive === '1' || req.query.includeInactive === 'true';
    await ensureTelecrmDefaults(prisma, tenantId);
    const categories = await prisma.telecrmPriceCategory.findMany({
      where: {
        tenantId,
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        items: {
          where: includeInactive ? { tenantId } : { tenantId, isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
    res.json({ categories: categories.map(serializeCategory) });
  },
);

categoriesRouter.post('/', requireStaffPermission('crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const { label, sortOrder } = req.body as { label?: string; sortOrder?: number };
  const trimmed = label?.trim() ?? '';
  if (!trimmed) {
    res.status(400).json({ error: '카테고리 이름을 입력해주세요.' });
    return;
  }
  const maxOrder = await prisma.telecrmPriceCategory.aggregate({
    where: { tenantId },
    _max: { sortOrder: true },
  });
  const created = await prisma.telecrmPriceCategory.create({
    data: {
      tenantId,
      label: trimmed,
      sortOrder: sortOrder ?? (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });
  res.status(201).json(serializeCategory(created));
});

categoriesRouter.patch('/:id', requireStaffPermission('crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const { id } = req.params;
  const existing = await prisma.telecrmPriceCategory.findFirst({ where: { id, tenantId } });
  if (!existing) {
    res.status(404).json({ error: '카테고리를 찾을 수 없습니다.' });
    return;
  }
  const { label, sortOrder, isActive } = req.body as {
    label?: string;
    sortOrder?: number;
    isActive?: boolean;
  };
  const updated = await prisma.telecrmPriceCategory.update({
    where: { id: existing.id },
    data: {
      ...(label != null && { label: String(label).trim() }),
      ...(sortOrder != null && { sortOrder: parseSortOrder(sortOrder) }),
      ...(isActive != null && { isActive: Boolean(isActive) }),
    },
  });
  res.json(serializeCategory(updated));
});

categoriesRouter.delete('/:id', requireStaffPermission('crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const user = (req as unknown as { user: AuthPayload }).user;
  const { password } = req.body as { password?: string };
  if (!(await requireTelecrmActorPassword(res, user.userId, tenantId, password))) return;

  const { id } = req.params;
  const existing = await prisma.telecrmPriceCategory.findFirst({ where: { id, tenantId } });
  if (!existing) {
    res.status(404).json({ error: '카테고리를 찾을 수 없습니다.' });
    return;
  }
  await prisma.telecrmPriceCategory.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});

categoriesRouter.post('/reorder', requireStaffPermission('crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const { orderedIds } = req.body as { orderedIds?: string[] };
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    res.status(400).json({ error: 'orderedIds가 필요합니다.' });
    return;
  }
  const rows = await prisma.telecrmPriceCategory.findMany({
    where: { tenantId, id: { in: orderedIds } },
    select: { id: true },
  });
  if (rows.length !== orderedIds.length) {
    res.status(400).json({ error: '잘못된 카테고리 ID가 포함되어 있습니다.' });
    return;
  }
  await prisma.$transaction(
    orderedIds.map((categoryId, index) =>
      prisma.telecrmPriceCategory.updateMany({
        where: { id: categoryId, tenantId },
        data: { sortOrder: index },
      }),
    ),
  );
  res.json({ ok: true });
});

export const telecrmPriceCategoriesRouter = categoriesRouter;

const itemsRouter = Router();
itemsRouter.use(authMiddleware, staffMarketerRoleOnly);

itemsRouter.get('/', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const categoryId = typeof req.query.categoryId === 'string' ? req.query.categoryId : '';
  if (!categoryId) {
    res.status(400).json({ error: 'categoryId가 필요합니다.' });
    return;
  }
  const category = await prisma.telecrmPriceCategory.findFirst({
    where: { id: categoryId, tenantId },
  });
  if (!category) {
    res.status(404).json({ error: '카테고리를 찾을 수 없습니다.' });
    return;
  }
  const includeInactive = req.query.includeInactive === '1' || req.query.includeInactive === 'true';
  const items = await prisma.telecrmPriceItem.findMany({
    where: {
      tenantId,
      categoryId,
      ...(includeInactive ? {} : { isActive: true }),
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  res.json({ items: items.map(serializeItem) });
});

itemsRouter.post('/', requireStaffPermission('crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const { categoryId, name, amountWon, description, sortOrder } = req.body as {
    categoryId?: string;
    name?: string;
    amountWon?: number | string;
    description?: string;
    sortOrder?: number;
  };
  if (!categoryId) {
    res.status(400).json({ error: 'categoryId가 필요합니다.' });
    return;
  }
  const category = await prisma.telecrmPriceCategory.findFirst({
    where: { id: categoryId, tenantId },
  });
  if (!category) {
    res.status(404).json({ error: '카테고리를 찾을 수 없습니다.' });
    return;
  }
  const trimmed = name?.trim() ?? '';
  if (!trimmed) {
    res.status(400).json({ error: '항목 이름을 입력해주세요.' });
    return;
  }
  const amount = parseAmountWon(amountWon);
  if (amount == null) {
    res.status(400).json({ error: '금액을 입력해주세요.' });
    return;
  }
  const maxOrder = await prisma.telecrmPriceItem.aggregate({
    where: { tenantId, categoryId },
    _max: { sortOrder: true },
  });
  const created = await prisma.telecrmPriceItem.create({
    data: {
      tenantId,
      categoryId,
      name: trimmed,
      amountWon: amount,
      description: description?.trim() || null,
      sortOrder: sortOrder ?? (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });
  res.status(201).json(serializeItem(created));
});

itemsRouter.patch('/:id', requireStaffPermission('crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const { id } = req.params;
  const existing = await prisma.telecrmPriceItem.findFirst({ where: { id, tenantId } });
  if (!existing) {
    res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
    return;
  }
  const { name, amountWon, description, sortOrder, isActive } = req.body as {
    name?: string;
    amountWon?: number | string;
    description?: string | null;
    sortOrder?: number;
    isActive?: boolean;
  };
  const amount = amountWon != null ? parseAmountWon(amountWon) : undefined;
  if (amountWon != null && amount == null) {
    res.status(400).json({ error: '금액 형식이 올바르지 않습니다.' });
    return;
  }
  const updated = await prisma.telecrmPriceItem.update({
    where: { id: existing.id },
    data: {
      ...(name != null && { name: String(name).trim() }),
      ...(amount != null && { amountWon: amount }),
      ...(description !== undefined && { description: description?.trim() || null }),
      ...(sortOrder != null && { sortOrder: parseSortOrder(sortOrder) }),
      ...(isActive != null && { isActive: Boolean(isActive) }),
    },
  });
  res.json(serializeItem(updated));
});

itemsRouter.delete('/:id', requireStaffPermission('crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const user = (req as unknown as { user: AuthPayload }).user;
  const { password } = req.body as { password?: string };
  if (!(await requireTelecrmActorPassword(res, user.userId, tenantId, password))) return;

  const { id } = req.params;
  const existing = await prisma.telecrmPriceItem.findFirst({ where: { id, tenantId } });
  if (!existing) {
    res.status(404).json({ error: '항목을 찾을 수 없습니다.' });
    return;
  }
  await prisma.telecrmPriceItem.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});

itemsRouter.post('/reorder', requireStaffPermission('crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const { categoryId, orderedIds } = req.body as { categoryId?: string; orderedIds?: string[] };
  if (!categoryId || !Array.isArray(orderedIds) || orderedIds.length === 0) {
    res.status(400).json({ error: 'categoryId와 orderedIds가 필요합니다.' });
    return;
  }
  const category = await prisma.telecrmPriceCategory.findFirst({
    where: { id: categoryId, tenantId },
  });
  if (!category) {
    res.status(404).json({ error: '카테고리를 찾을 수 없습니다.' });
    return;
  }
  const rows = await prisma.telecrmPriceItem.findMany({
    where: { tenantId, categoryId, id: { in: orderedIds } },
    select: { id: true },
  });
  if (rows.length !== orderedIds.length) {
    res.status(400).json({ error: '잘못된 항목 ID가 포함되어 있습니다.' });
    return;
  }
  await prisma.$transaction(
    orderedIds.map((itemId, index) =>
      prisma.telecrmPriceItem.updateMany({
        where: { id: itemId, tenantId, categoryId },
        data: { sortOrder: index },
      }),
    ),
  );
  res.json({ ok: true });
});

export const telecrmPriceItemsRouter = itemsRouter;

/** 작업 화면용 통합 카탈로그 + 검색 */
const catalogRouter = Router();
catalogRouter.use(authMiddleware, staffMarketerRoleOnly);

catalogRouter.get('/catalog', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  await ensureTelecrmDefaults(prisma, tenantId);
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';

  const categories = await prisma.telecrmPriceCategory.findMany({
    where: { tenantId, isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: {
      items: {
        where: {
          tenantId,
          isActive: true,
          ...(q
            ? {
                OR: [
                  { name: { contains: q, mode: 'insensitive' as const } },
                  { description: { contains: q, mode: 'insensitive' as const } },
                ],
              }
            : {}),
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      },
    },
  });

  const config = await getOrCreateEstimateConfig(prisma, tenantId);
  res.json({
    categories: categories.map(serializeCategory),
    estimateConfig: {
      pricePerPyeong: config.pricePerPyeong,
      depositAmount: config.depositAmount,
      minimumTotalAmount: config.minimumTotalAmount,
    },
  });
});

export const telecrmPricingCatalogRouter = catalogRouter;
