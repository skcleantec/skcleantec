import { prisma } from '../../lib/prisma.js';
import {
  buildAreaInstanceKey,
  buildAreaInstanceLabel,
  COUNTABLE_INSPECTION_AREA_TEMPLATE_KEYS,
  isCountableInspectionAreaKey,
  MAX_INSPECTION_AREA_INSTANCES,
  nextAreaInstanceNumber,
  type CountableInspectionAreaTemplateKey,
} from '../../lib/inquiryInspectionAreaInstances.js';
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
