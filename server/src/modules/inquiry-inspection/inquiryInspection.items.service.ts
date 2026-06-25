import { InquiryInspectionStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { INSPECTION_TEMPLATE_VERSION } from '../../lib/inquiryInspectionTemplate.js';
import { resolveInspectionItemsForArea } from '../../lib/inquiryInspectionTenantTemplate.js';
import { getTenantConfig } from '../tenants/tenantConfig.service.js';

const PLACEHOLDER_ITEM_KEYS = new Set(['_legacy', '_pending_seed']);

export async function ensureInspectionItemsForChecklist(
  checklistId: string,
  tenantId?: string,
): Promise<void> {
  let tid = tenantId;
  if (!tid) {
    const row = await prisma.inquiryInspectionChecklist.findUnique({
      where: { id: checklistId },
      select: { tenantId: true },
    });
    tid = row?.tenantId;
  }
  const tenantConfig = tid ? await getTenantConfig(tid) : {};
  const inspectionTemplate = tenantConfig.inspection ?? null;

  const areas = await prisma.inquiryInspectionArea.findMany({
    where: { checklistId },
    include: { items: { include: { photos: true } } },
  });

  for (const area of areas) {
    await ensureAreaStandardItems(area, inspectionTemplate);
  }

  const checklist = await prisma.inquiryInspectionChecklist.findUnique({
    where: { id: checklistId },
    select: { status: true, templateVersion: true },
  });
  if (
    checklist &&
    (checklist.status === InquiryInspectionStatus.IN_PROGRESS ||
      checklist.status === InquiryInspectionStatus.AWAITING_CUSTOMER) &&
    checklist.templateVersion !== INSPECTION_TEMPLATE_VERSION
  ) {
    await prisma.inquiryInspectionChecklist.update({
      where: { id: checklistId },
      data: { templateVersion: INSPECTION_TEMPLATE_VERSION },
    });
  }
}

type AreaWithItems = {
  id: string;
  areaKey: string;
  isCustom: boolean;
  items: Array<{
    id: string;
    itemKey: string;
    label: string;
    isCustom: boolean;
    sortOrder: number;
    photos: unknown[];
  }>;
};

async function ensureAreaStandardItems(
  area: AreaWithItems,
  inspectionTemplate: { areaItems?: Record<string, Array<{ itemKey: string; label: string }>> } | null,
): Promise<void> {
  const standardDefs = resolveInspectionItemsForArea(area.areaKey, inspectionTemplate);
  if (!standardDefs.length) return;

  const defByKey = new Map(standardDefs.map((d) => [d.itemKey, d]));
  const defKeys = new Set(standardDefs.map((d) => d.itemKey));

  for (const item of area.items) {
    if (PLACEHOLDER_ITEM_KEYS.has(item.itemKey) && item.photos.length === 0) {
      await prisma.inquiryInspectionItem.delete({ where: { id: item.id } }).catch(() => undefined);
      continue;
    }
    if (item.isCustom) continue;
    if (defKeys.has(item.itemKey)) continue;
    if (item.photos.length > 0) continue;
    await prisma.inquiryInspectionItem.delete({ where: { id: item.id } }).catch(() => undefined);
  }

  const remaining = await prisma.inquiryInspectionItem.findMany({
    where: { areaId: area.id },
    select: { itemKey: true },
  });
  const existingKeys = new Set(remaining.map((i) => i.itemKey));
  const toCreate = standardDefs.filter((d) => !existingKeys.has(d.itemKey));
  if (toCreate.length) {
    const maxSort = area.items.reduce((m, i) => Math.max(m, i.sortOrder), -1);
    await prisma.inquiryInspectionItem.createMany({
      data: toCreate.map((d, idx) => ({
        areaId: area.id,
        itemKey: d.itemKey,
        label: d.label,
        sortOrder: maxSort + 1 + idx,
        isCustom: false,
      })),
    });
  }

  const allItems = await prisma.inquiryInspectionItem.findMany({
    where: { areaId: area.id },
  });

  for (const item of allItems) {
    const def = defByKey.get(item.itemKey);
    if (def && !item.isCustom && def.label !== item.label) {
      await prisma.inquiryInspectionItem.update({
        where: { id: item.id },
        data: { label: def.label },
      });
    }
  }

  const legacyStandard = allItems
    .filter((i) => !i.isCustom && !defKeys.has(i.itemKey))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.itemKey.localeCompare(b.itemKey));
  const customItems = allItems
    .filter((i) => i.isCustom)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.itemKey.localeCompare(b.itemKey));

  let order = 0;
  for (const def of standardDefs) {
    const item = allItems.find((i) => i.itemKey === def.itemKey);
    if (item && item.sortOrder !== order) {
      await prisma.inquiryInspectionItem.update({
        where: { id: item.id },
        data: { sortOrder: order },
      });
    }
    order += 1;
  }
  for (const leg of legacyStandard) {
    if (leg.sortOrder !== order) {
      await prisma.inquiryInspectionItem.update({
        where: { id: leg.id },
        data: { sortOrder: order },
      });
    }
    order += 1;
  }
  for (const custom of customItems) {
    if (custom.sortOrder !== order) {
      await prisma.inquiryInspectionItem.update({
        where: { id: custom.id },
        data: { sortOrder: order },
      });
    }
    order += 1;
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
