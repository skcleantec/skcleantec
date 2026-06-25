import { prisma } from '../../lib/prisma.js';
import {
  buildAreaInstanceKey,
  buildAreaInstanceLabel,
  COUNTABLE_INSPECTION_AREA_TEMPLATE_KEYS,
  isCountableInspectionAreaKey,
  MAX_INSPECTION_AREA_INSTANCES,
  nextAreaInstanceNumber,
  parseAreaInstanceNumber,
  type CountableInspectionAreaTemplateKey,
} from '../../lib/inquiryInspectionAreaInstances.js';
import {
  buildStandardInspectionAreas,
  type InquiryInspectionAreaStructureInput,
} from '../../lib/inquiryInspectionTemplate.js';
import { INSPECTION_CONTAMINATION_AREA_KEY } from '../../lib/inquiryInspectionContamination.js';
import { normalizeAreaKeyForTemplate, resolveInspectionItemsForArea } from '../../lib/inquiryInspectionTenantTemplate.js';
import { getTenantConfig } from '../tenants/tenantConfig.service.js';
import { deleteInspectionPhoto } from './inquiryInspection.photos.service.js';
import { inspectionChecklistInclude } from './inquiryInspection.include.js';

function isEditableStatus(status: string): boolean {
  return status === 'IN_PROGRESS' || status === 'AWAITING_CUSTOMER';
}

function assertCountableTemplateKey(key: string): CountableInspectionAreaTemplateKey {
  if (!COUNTABLE_INSPECTION_AREA_TEMPLATE_KEYS.includes(key as CountableInspectionAreaTemplateKey)) {
    throw Object.assign(new Error('not_countable'), { code: 'bad_request' as const });
  }
  return key as CountableInspectionAreaTemplateKey;
}

function standardAreasOfType(
  areas: Array<{ areaKey: string; sortOrder: number; isCustom: boolean }>,
  templateKey: string,
) {
  return areas
    .filter((a) => !a.isCustom && normalizeAreaKeyForTemplate(a.areaKey) === templateKey)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.areaKey.localeCompare(b.areaKey));
}

async function relabelAreaInstances(
  checklistId: string,
  templateKey: CountableInspectionAreaTemplateKey,
): Promise<void> {
  const areas = await prisma.inquiryInspectionArea.findMany({
    where: { checklistId, isCustom: false },
    select: { id: true, areaKey: true, sortOrder: true },
  });
  const group = areas
    .filter((a) => normalizeAreaKeyForTemplate(a.areaKey) === templateKey)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.areaKey.localeCompare(b.areaKey));
  const total = group.length;
  await Promise.all(
    group.map((a, idx) =>
      prisma.inquiryInspectionArea.update({
        where: { id: a.id },
        data: { label: buildAreaInstanceLabel(templateKey, idx + 1, total) },
      }),
    ),
  );
}

export async function addInspectionAreaInstance(params: {
  checklistId: string;
  tenantId: string;
  templateKey: string;
}) {
  const templateKey = assertCountableTemplateKey(params.templateKey.trim());

  const row = await prisma.inquiryInspectionChecklist.findFirst({
    where: { id: params.checklistId, tenantId: params.tenantId },
    include: { areas: { select: { areaKey: true, sortOrder: true, isCustom: true } } },
  });
  if (!row) throw Object.assign(new Error('not_found'), { code: 'not_found' as const });
  if (!isEditableStatus(row.status)) throw Object.assign(new Error('locked'), { code: 'locked' as const });

  const group = standardAreasOfType(row.areas, templateKey);
  if (group.length >= MAX_INSPECTION_AREA_INSTANCES) {
    throw Object.assign(new Error('max_instances'), { code: 'bad_request' as const });
  }

  const instanceNum = nextAreaInstanceNumber(
    row.areas.map((a) => a.areaKey),
    templateKey,
  );
  const areaKey = buildAreaInstanceKey(templateKey, instanceNum);
  const exists = row.areas.some((a) => a.areaKey === areaKey);
  if (exists) {
    throw Object.assign(new Error('duplicate_key'), { code: 'bad_request' as const });
  }

  const tenantConfig = await getTenantConfig(params.tenantId);
  const itemDefs = resolveInspectionItemsForArea(areaKey, tenantConfig.inspection ?? null);
  const maxSort = row.areas.reduce((m, a) => Math.max(m, a.sortOrder), -1);
  const lastSameSort = group.length ? Math.max(...group.map((a) => a.sortOrder)) : -1;
  const sortOrder = lastSameSort >= 0 ? lastSameSort + 1 : maxSort + 1;

  await prisma.inquiryInspectionArea.create({
    data: {
      checklistId: row.id,
      areaKey,
      label: areaKey,
      sortOrder,
      isCustom: false,
      items: {
        create: itemDefs.map((it, idx) => ({
          itemKey: it.itemKey,
          label: it.label,
          sortOrder: idx,
          isCustom: false,
        })),
      },
    },
  });

  await relabelAreaInstances(row.id, templateKey);

  return prisma.inquiryInspectionChecklist.findFirst({
    where: { id: row.id },
    include: inspectionChecklistInclude,
  });
}

export async function removeInspectionAreaInstance(params: {
  checklistId: string;
  tenantId: string;
  areaId: string;
}) {
  const row = await prisma.inquiryInspectionChecklist.findFirst({
    where: { id: params.checklistId, tenantId: params.tenantId },
    include: {
      areas: {
        include: {
          items: { include: { photos: { select: { id: true, cloudinaryPublicId: true } } } },
        },
      },
    },
  });
  if (!row) throw Object.assign(new Error('not_found'), { code: 'not_found' as const });
  if (!isEditableStatus(row.status)) throw Object.assign(new Error('locked'), { code: 'locked' as const });

  const area = row.areas.find((a) => a.id === params.areaId);
  if (!area) throw Object.assign(new Error('area_not_found'), { code: 'not_found' as const });
  if (area.isCustom || !isCountableInspectionAreaKey(area.areaKey)) {
    throw Object.assign(new Error('not_removable'), { code: 'bad_request' as const });
  }

  const templateKey = normalizeAreaKeyForTemplate(area.areaKey) as CountableInspectionAreaTemplateKey;
  const group = standardAreasOfType(row.areas, templateKey);
  if (group.length <= 1) {
    throw Object.assign(new Error('min_instances'), { code: 'bad_request' as const });
  }

  for (const item of area.items) {
    for (const photo of item.photos) {
      await deleteInspectionPhoto({
        photoId: photo.id,
        itemId: item.id,
        checklistId: row.id,
      });
    }
  }

  await prisma.inquiryInspectionArea.delete({ where: { id: area.id } });
  await relabelAreaInstances(row.id, templateKey);

  return prisma.inquiryInspectionChecklist.findFirst({
    where: { id: row.id },
    include: inspectionChecklistInclude,
  });
}

type AreaWithItemsAndPhotos = {
  id: string;
  areaKey: string;
  label: string;
  sortOrder: number;
  isCustom: boolean;
  items: Array<{ photos: unknown[] }>;
};

function areaHasAnyPhoto(area: AreaWithItemsAndPhotos): boolean {
  return area.items.some((i) => i.photos.length > 0);
}

/**
 * 진행 중 체크리스트 구역을 접수(room·주방·욕실 개수)와 맞춤.
 * 사진 없는 초과 구역은 제거, 부족 구역은 추가. 사진 있는 초과 구역은 유지.
 */
export async function syncChecklistAreasFromInquiry(params: {
  checklistId: string;
  tenantId: string;
  inquiry: InquiryInspectionAreaStructureInput;
}): Promise<void> {
  const checklist = await prisma.inquiryInspectionChecklist.findFirst({
    where: { id: params.checklistId, tenantId: params.tenantId },
    select: { id: true, status: true },
  });
  if (!checklist || !isEditableStatus(checklist.status)) return;

  const expected = buildStandardInspectionAreas(params.inquiry);
  const expectedKeys = new Set(expected.map((a) => a.areaKey));

  const tenantConfig = await getTenantConfig(params.tenantId);
  const inspectionTemplate = tenantConfig.inspection ?? null;

  let areas = await prisma.inquiryInspectionArea.findMany({
    where: { checklistId: params.checklistId },
    include: { items: { include: { photos: { select: { id: true } } } } },
    orderBy: { sortOrder: 'asc' },
  });

  for (const area of areas) {
    if (area.isCustom) continue;
    if (area.areaKey === INSPECTION_CONTAMINATION_AREA_KEY) continue;
    if (expectedKeys.has(area.areaKey)) continue;
    if (areaHasAnyPhoto(area)) continue;
    await prisma.inquiryInspectionArea.delete({ where: { id: area.id } });
  }

  areas = await prisma.inquiryInspectionArea.findMany({
    where: { checklistId: params.checklistId },
    include: { items: { include: { photos: { select: { id: true } } } } },
    orderBy: { sortOrder: 'asc' },
  });

  const existingKeys = new Set(areas.filter((a) => !a.isCustom).map((a) => a.areaKey));
  for (const exp of expected) {
    if (existingKeys.has(exp.areaKey)) continue;
    const itemDefs = resolveInspectionItemsForArea(exp.areaKey, inspectionTemplate);
    await prisma.inquiryInspectionArea.create({
      data: {
        checklistId: params.checklistId,
        areaKey: exp.areaKey,
        label: exp.label,
        sortOrder: exp.sortOrder,
        isCustom: false,
        items: {
          create: itemDefs.map((it, idx) => ({
            itemKey: it.itemKey,
            label: it.label,
            sortOrder: idx,
            isCustom: false,
          })),
        },
      },
    });
  }

  areas = await prisma.inquiryInspectionArea.findMany({
    where: { checklistId: params.checklistId },
    include: { items: { include: { photos: { select: { id: true } } } } },
    orderBy: { sortOrder: 'asc' },
  });

  const standardAreas = areas.filter((a) => !a.isCustom);
  const customAreas = areas.filter((a) => a.isCustom).sort((a, b) => a.sortOrder - b.sortOrder);
  const surplusStandard = standardAreas
    .filter((a) => !expectedKeys.has(a.areaKey) && a.areaKey !== INSPECTION_CONTAMINATION_AREA_KEY)
    .sort((a, b) => {
      const ta = normalizeAreaKeyForTemplate(a.areaKey);
      const tb = normalizeAreaKeyForTemplate(b.areaKey);
      if (ta !== tb) return ta.localeCompare(tb);
      return parseAreaInstanceNumber(a.areaKey, ta) - parseAreaInstanceNumber(b.areaKey, tb);
    });

  let order = 0;
  for (const exp of expected) {
    const area = standardAreas.find((a) => a.areaKey === exp.areaKey);
    if (!area) continue;
    if (area.label !== exp.label || area.sortOrder !== order) {
      await prisma.inquiryInspectionArea.update({
        where: { id: area.id },
        data: { label: exp.label, sortOrder: order },
      });
    }
    order += 1;
  }

  for (const area of surplusStandard) {
    if (area.sortOrder !== order) {
      await prisma.inquiryInspectionArea.update({
        where: { id: area.id },
        data: { sortOrder: order },
      });
    }
    order += 1;
  }

  for (const area of customAreas) {
    if (area.sortOrder !== order) {
      await prisma.inquiryInspectionArea.update({
        where: { id: area.id },
        data: { sortOrder: order },
      });
    }
    order += 1;
  }

  for (const templateKey of ['kitchen', 'room', 'bathroom'] as const) {
    await relabelAreaInstances(params.checklistId, templateKey);
  }

  await ensureContaminationInspectionArea({
    checklistId: params.checklistId,
    inspectionTemplate,
  });
}

async function ensureContaminationInspectionArea(params: {
  checklistId: string;
  inspectionTemplate: { areaItems?: Record<string, Array<{ itemKey: string; label: string }>> } | null;
}): Promise<void> {
  const itemDefs = resolveInspectionItemsForArea(
    INSPECTION_CONTAMINATION_AREA_KEY,
    params.inspectionTemplate,
  );
  if (!itemDefs.length) return;

  let contamination = await prisma.inquiryInspectionArea.findFirst({
    where: { checklistId: params.checklistId, areaKey: INSPECTION_CONTAMINATION_AREA_KEY },
    include: { items: true },
  });

  if (!contamination) {
    contamination = await prisma.inquiryInspectionArea.create({
      data: {
        checklistId: params.checklistId,
        areaKey: INSPECTION_CONTAMINATION_AREA_KEY,
        label: '오염사진',
        sortOrder: 9999,
        isCustom: false,
        items: {
          create: itemDefs.map((it, idx) => ({
            itemKey: it.itemKey,
            label: it.label,
            sortOrder: idx,
            isCustom: false,
          })),
        },
      },
      include: { items: true },
    });
  } else if (contamination.label !== '오염사진') {
    await prisma.inquiryInspectionArea.update({
      where: { id: contamination.id },
      data: { label: '오염사진' },
    });
  }

  const existingItemKeys = new Set(contamination.items.map((i) => i.itemKey));
  const toCreate = itemDefs.filter((d) => !existingItemKeys.has(d.itemKey));
  if (toCreate.length) {
    const maxSort = contamination.items.reduce((m, i) => Math.max(m, i.sortOrder), -1);
    await prisma.inquiryInspectionItem.createMany({
      data: toCreate.map((d, idx) => ({
        areaId: contamination!.id,
        itemKey: d.itemKey,
        label: d.label,
        sortOrder: maxSort + 1 + idx,
        isCustom: false,
      })),
    });
  }

  const areas = await prisma.inquiryInspectionArea.findMany({
    where: { checklistId: params.checklistId },
    orderBy: { sortOrder: 'asc' },
  });
  const standard = areas.filter((a) => !a.isCustom && a.areaKey !== INSPECTION_CONTAMINATION_AREA_KEY);
  const custom = areas.filter((a) => a.isCustom);
  const cont = areas.find((a) => a.areaKey === INSPECTION_CONTAMINATION_AREA_KEY);
  if (!cont) return;

  let order = 0;
  for (const area of standard) {
    if (area.sortOrder !== order) {
      await prisma.inquiryInspectionArea.update({
        where: { id: area.id },
        data: { sortOrder: order },
      });
    }
    order += 1;
  }
  if (cont.sortOrder !== order) {
    await prisma.inquiryInspectionArea.update({
      where: { id: cont.id },
      data: { sortOrder: order },
    });
  }
  order += 1;
  for (const area of custom) {
    if (area.sortOrder !== order) {
      await prisma.inquiryInspectionArea.update({
        where: { id: area.id },
        data: { sortOrder: order },
      });
    }
    order += 1;
  }
}
