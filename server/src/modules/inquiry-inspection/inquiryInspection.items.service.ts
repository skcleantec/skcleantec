import { prisma } from '../../lib/prisma.js';
import { buildStandardItemsForAreaKey } from '../../lib/inquiryInspectionItems.js';

const PLACEHOLDER_ITEM_KEYS = new Set(['_legacy', '_pending_seed']);

export async function ensureInspectionItemsForChecklist(checklistId: string): Promise<void> {
  const areas = await prisma.inquiryInspectionArea.findMany({
    where: { checklistId },
    include: { items: { include: { photos: true } } },
  });

  for (const area of areas) {
    await ensureAreaStandardItems(area);
  }
}

type AreaWithItems = {
  id: string;
  areaKey: string;
  isCustom: boolean;
  items: Array<{ id: string; itemKey: string; photos: unknown[] }>;
};

async function ensureAreaStandardItems(area: AreaWithItems): Promise<void> {
  const standardDefs = buildStandardItemsForAreaKey(area.areaKey);
  if (!standardDefs.length) return;

  const existingKeys = new Set(area.items.map((i) => i.itemKey));
  const toCreate = standardDefs.filter((d) => !existingKeys.has(d.itemKey));
  if (toCreate.length) {
    await prisma.inquiryInspectionItem.createMany({
      data: toCreate.map((d, idx) => ({
        areaId: area.id,
        itemKey: d.itemKey,
        label: d.label,
        sortOrder: idx,
        isCustom: false,
      })),
    });
  }

  for (const item of area.items) {
    if (PLACEHOLDER_ITEM_KEYS.has(item.itemKey) && item.photos.length === 0) {
      await prisma.inquiryInspectionItem.delete({ where: { id: item.id } }).catch(() => undefined);
    }
  }
}

export async function addCustomInspectionItem(params: {
  checklistId: string;
  tenantId: string;
  areaId: string;
  label: string;
}) {
  const checklist = await prisma.inquiryInspectionChecklist.findFirst({
    where: { id: params.checklistId, tenantId: params.tenantId },
    include: { areas: { where: { id: params.areaId }, include: { items: true } } },
  });
  if (!checklist) throw Object.assign(new Error('not_found'), { code: 'not_found' as const });
  const area = checklist.areas[0];
  if (!area) throw Object.assign(new Error('area_not_found'), { code: 'not_found' as const });

  const label = params.label.trim().slice(0, 120);
  if (!label) throw Object.assign(new Error('label_required'), { code: 'bad_request' as const });

  const customIndex = area.items.filter((i) => i.isCustom).length + 1;
  const itemKey = `custom_${customIndex}_${Date.now()}`;
  const maxSort = area.items.reduce((m, i) => Math.max(m, i.sortOrder), -1);

  return prisma.inquiryInspectionItem.create({
    data: {
      areaId: area.id,
      itemKey,
      label,
      sortOrder: maxSort + 1,
      isCustom: true,
    },
  });
}

export async function patchInspectionItem(params: {
  checklistId: string;
  tenantId: string;
  itemId: string;
  notApplicable?: boolean;
  naReason?: string | null;
}) {
  const checklist = await prisma.inquiryInspectionChecklist.findFirst({
    where: { id: params.checklistId, tenantId: params.tenantId },
  });
  if (!checklist) throw Object.assign(new Error('not_found'), { code: 'not_found' as const });

  const item = await prisma.inquiryInspectionItem.findFirst({
    where: { id: params.itemId, area: { checklistId: checklist.id } },
  });
  if (!item) throw Object.assign(new Error('item_not_found'), { code: 'not_found' as const });

  const data: { notApplicable?: boolean; naReason?: string | null } = {};
  if (typeof params.notApplicable === 'boolean') {
    data.notApplicable = params.notApplicable;
    data.naReason = params.notApplicable ? params.naReason?.trim().slice(0, 500) ?? null : null;
  } else if ('naReason' in params) {
    data.naReason = params.naReason?.trim().slice(0, 500) ?? null;
  }

  return prisma.inquiryInspectionItem.update({ where: { id: item.id }, data });
}
