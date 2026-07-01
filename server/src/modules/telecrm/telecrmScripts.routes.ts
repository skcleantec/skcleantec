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
import { ensureTelecrmDefaults } from './telecrmSeed.service.js';

const router = Router();
router.use(authMiddleware, staffMarketerRoleOnly);

function serializeCategory(row: {
  id: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
  ownerUserId?: string | null;
  tabs?: {
    id: string;
    categoryId: string;
    label: string;
    body: string;
    sortOrder: number;
    isActive: boolean;
  }[];
}) {
  return {
    id: row.id,
    label: row.label,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    ownerUserId: row.ownerUserId ?? null,
    ownerScope: telecrmCategoryOwnerScope(row.ownerUserId ?? null),
    tabs: row.tabs?.map(serializeTab) ?? undefined,
  };
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
    await ensureTelecrmDefaults(prisma, tenantId);
    const rows = await prisma.telecrmScriptCategory.findMany({
      where: {
        ...telecrmScriptCategoryWhere(scope, tenantId, user.userId),
        ...(includeInactive ? {} : { isActive: true }),
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: {
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
  const { label, sortOrder } = req.body as { label?: string; sortOrder?: number };
  const trimmed = label?.trim() ?? '';
  if (!trimmed) {
    res.status(400).json({ error: '카테고리 이름을 입력해주세요.' });
    return;
  }
  const maxOrder = await prisma.telecrmScriptCategory.aggregate({
    where: {
      tenantId,
      ownerUserId: ownerScope === 'personal' ? user.userId : null,
    },
    _max: { sortOrder: true },
  });
  const created = await prisma.telecrmScriptCategory.create({
    data: {
      tenantId,
      ownerUserId: ownerScope === 'personal' ? user.userId : null,
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
    include: { tabs: true },
  });
  res.status(201).json(serializeCategory(created));
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
  const { label, sortOrder, isActive } = req.body as {
    label?: string;
    sortOrder?: number;
    isActive?: boolean;
  };
  const updated = await prisma.telecrmScriptCategory.update({
    where: { id: existing.id },
    data: {
      ...(label != null && { label: String(label).trim() }),
      ...(sortOrder != null && { sortOrder: parseSortOrder(sortOrder) }),
      ...(isActive != null && { isActive: Boolean(isActive) }),
    },
  });
  res.json(serializeCategory(updated));
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
