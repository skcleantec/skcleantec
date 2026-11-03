import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware, type AuthPayload } from '../auth/auth.middleware.js';
import { requireStaffPermission, staffMarketerRoleOnly } from '../auth/marketerPermission.middleware.js';
import {
  parseSortOrder,
  requireTelecrmActorPassword,
  requireTelecrmTenant,
} from './telecrm.helpers.js';
import {
  denyUnlessCanCreateTelecrmCatalog,
  denyUnlessCanMutateTelecrmCategory,
  parseTelecrmCatalogOwnerScope,
  parseTelecrmCatalogScope,
  sortTelecrmCategoriesForWork,
  telecrmCategoryOwnerScope,
  telecrmScriptCategoryWhere,
} from './telecrmCatalogScope.helpers.js';
import { assertOperatingCompanyForTenant, parseTelecrmOperatingCompanyId } from './telecrmBrand.helpers.js';
import { requireCrmWorkOperatingCompanyId } from './telecrm.helpers.js';
import { ensureTelecrmDefaults } from './telecrmSeed.service.js';

const router = Router();
router.use(authMiddleware, staffMarketerRoleOnly);

function badgeColorKeyOf(config: unknown): string | null {
  if (!config || typeof config !== 'object') return null;
  const key = (config as { branding?: { badgeColorKey?: unknown } }).branding?.badgeColorKey;
  return typeof key === 'string' && key.trim() ? key.trim() : null;
}

function serializeCategory(row: {
  id: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
  ownerUserId?: string | null;
  operatingCompanyId?: string | null;
  operatingCompany?: {
    id: string;
    name: string;
    slug: string;
    isActive: boolean;
    config: unknown;
  } | null;
  tabs?: {
    id: string;
    categoryId: string;
    label: string;
    body: string;
    sortOrder: number;
    isActive: boolean;
  }[];
}) {
  const company = row.operatingCompany;
  return {
    id: row.id,
    label: row.label,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    ownerUserId: row.ownerUserId ?? null,
    ownerScope: telecrmCategoryOwnerScope(row.ownerUserId ?? null),
    operatingCompanyId: row.operatingCompanyId ?? null,
    operatingCompany: company
      ? {
          id: company.id,
          name: company.name,
          slug: company.slug,
          isActive: company.isActive,
          badgeColorKey: badgeColorKeyOf(company.config),
        }
      : null,
    tabs: row.tabs?.map(serializeTab) ?? undefined,
  };
}

const categoryInclude = {
  operatingCompany: { select: { id: true, name: true, slug: true, isActive: true, config: true } },
} as const;

async function readBrandId(tenantId: string, raw: unknown): Promise<string | null> {
  const operatingCompanyId = parseTelecrmOperatingCompanyId(raw);
  if (operatingCompanyId) await assertOperatingCompanyForTenant(tenantId, operatingCompanyId);
  return operatingCompanyId;
}

function serializeTab(row: {
  id: string;
  categoryId: string;
  label: string;
  body: string;
  sortOrder: number;
  isActive: boolean;
}) {
  return {
    id: row.id,
    categoryId: row.categoryId,
    label: row.label,
    body: row.body,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
  };
}

/** 작업 화면·설정 — 카테고리+탭 목록 */
router.get(
  '/',
  requireStaffPermission('crm.view', 'crm.settings'),
  async (req, res) => {
    const tenantId = requireTelecrmTenant(req, res);
    if (!tenantId) return;
    const user = (req as unknown as { user: AuthPayload }).user;
    const scope = parseTelecrmCatalogScope(req.query.scope);
    const includeInactive = req.query.includeInactive === '1' || req.query.includeInactive === 'true';
    let workBrandId: string | null = null;
    if (scope === 'work') {
      workBrandId = await requireCrmWorkOperatingCompanyId(req, res);
      if (!workBrandId) return;
    }
    await ensureTelecrmDefaults(prisma, tenantId);
    const rows = await prisma.telecrmScriptCategory.findMany({
      where: {
        ...telecrmScriptCategoryWhere(scope, tenantId, user.userId, workBrandId),
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
        ...categoryInclude,
        tabs: {
          where: includeInactive ? { tenantId } : { tenantId, isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        },
      },
    });
    const categories = (scope === 'work' ? sortTelecrmCategoriesForWork(rows) : rows).map(serializeCategory);
    res.json({ categories });
  },
);

router.post('/', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const user = (req as unknown as { user: AuthPayload }).user;
  const ownerScope = parseTelecrmCatalogOwnerScope(
    (req.body as { ownerScope?: string; scope?: string }).ownerScope ??
      (req.body as { scope?: string }).scope,
  );
  if (!(await denyUnlessCanCreateTelecrmCatalog(res, user, ownerScope))) return;
  const { label, sortOrder, operatingCompanyId: operatingCompanyIdRaw } = req.body as {
    label?: string;
    sortOrder?: number;
    operatingCompanyId?: string | null;
  };
  const trimmed = label?.trim() ?? '';
  if (!trimmed) {
    res.status(400).json({ error: '카테고리 이름을 입력해주세요.' });
    return;
  }
  try {
    const operatingCompanyId = await readBrandId(tenantId, operatingCompanyIdRaw);
    const maxOrder = await prisma.telecrmScriptCategory.aggregate({
      where: {
        tenantId,
        ownerUserId: ownerScope === 'personal' ? user.userId : null,
        operatingCompanyId,
      },
      _max: { sortOrder: true },
    });
    const created = await prisma.telecrmScriptCategory.create({
      data: {
        tenantId,
        ownerUserId: ownerScope === 'personal' ? user.userId : null,
        operatingCompanyId,
        label: trimmed,
        sortOrder: sortOrder ?? (maxOrder._max.sortOrder ?? -1) + 1,
        tabs: {
          create: {
            tenantId,
            label: '기본',
            body: '',
            sortOrder: 0,
          },
        },
      },
      include: { ...categoryInclude, tabs: true },
    });
    res.status(201).json(serializeCategory(created));
  } catch (e) {
    if (e instanceof Error && e.message === 'INVALID_BRAND') {
      res.status(400).json({ error: '브랜드를 찾을 수 없습니다.' });
      return;
    }
    throw e;
  }
});

router.patch('/:id', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const user = (req as unknown as { user: AuthPayload }).user;
  const { id } = req.params;
  const existing = await prisma.telecrmScriptCategory.findFirst({ where: { id, tenantId } });
  if (!existing) {
    res.status(404).json({ error: '카테고리를 찾을 수 없습니다.' });
    return;
  }
  if (!(await denyUnlessCanMutateTelecrmCategory(res, user, existing))) return;
  const body = req.body as {
    label?: string;
    sortOrder?: number;
    isActive?: boolean;
    operatingCompanyId?: string | null;
  };
  const brandProvided = Object.prototype.hasOwnProperty.call(req.body ?? {}, 'operatingCompanyId');
  try {
    const operatingCompanyId = brandProvided ? await readBrandId(tenantId, body.operatingCompanyId) : undefined;
    const updated = await prisma.telecrmScriptCategory.update({
      where: { id: existing.id },
      data: {
        ...(body.label != null && { label: String(body.label).trim() }),
        ...(body.sortOrder != null && { sortOrder: parseSortOrder(body.sortOrder) }),
        ...(body.isActive != null && { isActive: Boolean(body.isActive) }),
        ...(brandProvided ? { operatingCompanyId } : {}),
      },
      include: categoryInclude,
    });
    res.json(serializeCategory(updated));
  } catch (e) {
    if (e instanceof Error && e.message === 'INVALID_BRAND') {
      res.status(400).json({ error: '브랜드를 찾을 수 없습니다.' });
      return;
    }
    throw e;
  }
});

router.delete('/:id', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const user = (req as unknown as { user: AuthPayload }).user;
  const { password } = req.body as { password?: string };
  if (!(await requireTelecrmActorPassword(res, user.userId, tenantId, password))) return;

  const { id } = req.params;
  const existing = await prisma.telecrmScriptCategory.findFirst({ where: { id, tenantId } });
  if (!existing) {
    res.status(404).json({ error: '카테고리를 찾을 수 없습니다.' });
    return;
  }
  if (!(await denyUnlessCanMutateTelecrmCategory(res, user, existing))) return;
  await prisma.telecrmScriptCategory.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});

router.post('/reorder', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const user = (req as unknown as { user: AuthPayload }).user;
  const { orderedIds } = req.body as { orderedIds?: string[] };
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
    res.status(400).json({ error: 'orderedIds가 필요합니다.' });
    return;
  }
  const rows = await prisma.telecrmScriptCategory.findMany({
    where: { tenantId, id: { in: orderedIds } },
  });
  if (rows.length !== orderedIds.length) {
    res.status(400).json({ error: '잘못된 카테고리 ID가 포함되어 있습니다.' });
    return;
  }
  const ownerKey = rows[0]?.ownerUserId ?? null;
  if (!rows.every((r) => (r.ownerUserId ?? null) === ownerKey)) {
    res.status(400).json({ error: '같은 범위(내/공통) 카테고리만 함께 정렬할 수 있습니다.' });
    return;
  }
  if (!(await denyUnlessCanMutateTelecrmCategory(res, user, rows[0]!))) return;
  await prisma.$transaction(
    orderedIds.map((categoryId, index) =>
      prisma.telecrmScriptCategory.updateMany({
        where: { id: categoryId, tenantId },
        data: { sortOrder: index },
      }),
    ),
  );
  res.json({ ok: true });
});

export const telecrmScriptCategoriesRouter = router;

/** 스크립트 탭 */
const tabsRouter = Router();
tabsRouter.use(authMiddleware, staffMarketerRoleOnly);

tabsRouter.get('/', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const categoryId = typeof req.query.categoryId === 'string' ? req.query.categoryId : '';
  if (!categoryId) {
    res.status(400).json({ error: 'categoryId가 필요합니다.' });
    return;
  }
  const category = await prisma.telecrmScriptCategory.findFirst({
    where: { id: categoryId, tenantId },
  });
  if (!category) {
    res.status(404).json({ error: '카테고리를 찾을 수 없습니다.' });
    return;
  }
  const includeInactive = req.query.includeInactive === '1' || req.query.includeInactive === 'true';
  const tabs = await prisma.telecrmScriptTab.findMany({
    where: {
      tenantId,
      categoryId,
      ...(includeInactive ? {} : { isActive: true }),
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  res.json({ tabs: tabs.map(serializeTab) });
});

tabsRouter.post('/', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const user = (req as unknown as { user: AuthPayload }).user;
  const { categoryId, label, body, sortOrder } = req.body as {
    categoryId?: string;
    label?: string;
    body?: string;
    sortOrder?: number;
  };
  if (!categoryId) {
    res.status(400).json({ error: 'categoryId가 필요합니다.' });
    return;
  }
  const category = await prisma.telecrmScriptCategory.findFirst({
    where: { id: categoryId, tenantId },
  });
  if (!category) {
    res.status(404).json({ error: '카테고리를 찾을 수 없습니다.' });
    return;
  }
  if (!(await denyUnlessCanMutateTelecrmCategory(res, user, category))) return;
  const trimmed = label?.trim() ?? '';
  if (!trimmed) {
    res.status(400).json({ error: '탭 이름을 입력해주세요.' });
    return;
  }
  const maxOrder = await prisma.telecrmScriptTab.aggregate({
    where: { tenantId, categoryId },
    _max: { sortOrder: true },
  });
  const created = await prisma.telecrmScriptTab.create({
    data: {
      tenantId,
      categoryId,
      label: trimmed,
      body: body ?? '',
      sortOrder: sortOrder ?? (maxOrder._max.sortOrder ?? -1) + 1,
    },
  });
  res.status(201).json(serializeTab(created));
});

tabsRouter.patch('/:id', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const user = (req as unknown as { user: AuthPayload }).user;
  const { id } = req.params;
  const existing = await prisma.telecrmScriptTab.findFirst({
    where: { id, tenantId },
    include: { category: true },
  });
  if (!existing) {
    res.status(404).json({ error: '탭을 찾을 수 없습니다.' });
    return;
  }
  if (!(await denyUnlessCanMutateTelecrmCategory(res, user, existing.category))) return;
  const { label, body, sortOrder, isActive } = req.body as {
    label?: string;
    body?: string;
    sortOrder?: number;
    isActive?: boolean;
  };
  const updated = await prisma.telecrmScriptTab.update({
    where: { id: existing.id },
    data: {
      ...(label != null && { label: String(label).trim() }),
      ...(body != null && { body: String(body) }),
      ...(sortOrder != null && { sortOrder: parseSortOrder(sortOrder) }),
      ...(isActive != null && { isActive: Boolean(isActive) }),
    },
  });
  res.json(serializeTab(updated));
});

tabsRouter.delete('/:id', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const user = (req as unknown as { user: AuthPayload }).user;
  const { password } = req.body as { password?: string };
  if (!(await requireTelecrmActorPassword(res, user.userId, tenantId, password))) return;

  const { id } = req.params;
  const existing = await prisma.telecrmScriptTab.findFirst({
    where: { id, tenantId },
    include: { category: true },
  });
  if (!existing) {
    res.status(404).json({ error: '탭을 찾을 수 없습니다.' });
    return;
  }
  if (!(await denyUnlessCanMutateTelecrmCategory(res, user, existing.category))) return;
  await prisma.telecrmScriptTab.delete({ where: { id: existing.id } });
  res.json({ ok: true });
});

tabsRouter.post('/reorder', requireStaffPermission('crm.view', 'crm.settings'), async (req, res) => {
  const tenantId = requireTelecrmTenant(req, res);
  if (!tenantId) return;
  const user = (req as unknown as { user: AuthPayload }).user;
  const { categoryId, orderedIds } = req.body as { categoryId?: string; orderedIds?: string[] };
  if (!categoryId || !Array.isArray(orderedIds) || orderedIds.length === 0) {
    res.status(400).json({ error: 'categoryId와 orderedIds가 필요합니다.' });
    return;
  }
  const category = await prisma.telecrmScriptCategory.findFirst({
    where: { id: categoryId, tenantId },
  });
  if (!category) {
    res.status(404).json({ error: '카테고리를 찾을 수 없습니다.' });
    return;
  }
  if (!(await denyUnlessCanMutateTelecrmCategory(res, user, category))) return;
  const rows = await prisma.telecrmScriptTab.findMany({
    where: { tenantId, categoryId, id: { in: orderedIds } },
    select: { id: true },
  });
  if (rows.length !== orderedIds.length) {
    res.status(400).json({ error: '잘못된 탭 ID가 포함되어 있습니다.' });
    return;
  }
  await prisma.$transaction(
    orderedIds.map((tabId, index) =>
      prisma.telecrmScriptTab.updateMany({
        where: { id: tabId, tenantId, categoryId },
        data: { sortOrder: index },
      }),
    ),
  );
  res.json({ ok: true });
});

export const telecrmScriptTabsRouter = tabsRouter;
