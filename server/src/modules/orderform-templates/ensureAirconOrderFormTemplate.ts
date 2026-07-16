import type { Prisma, PrismaClient } from '@prisma/client';
import {
  AIRCON_ORDER_FORM_REMOVED_FIELD_KEYS,
  AIRCON_ORDER_FORM_TEMPLATE_DESCRIPTION,
  AIRCON_ORDER_FORM_TEMPLATE_FIELDS,
  AIRCON_ORDER_FORM_TEMPLATE_ICON,
  AIRCON_ORDER_FORM_TEMPLATE_SORT_ORDER,
  AIRCON_ORDER_FORM_TEMPLATE_TITLE,
} from './airconOrderFormTemplate.catalog.js';

type Db = PrismaClient | Prisma.TransactionClient;

function fieldSeedToCreateMany(
  tenantId: string,
  templateId: string,
  f: (typeof AIRCON_ORDER_FORM_TEMPLATE_FIELDS)[number],
): Prisma.OrderFormTemplateFieldCreateManyInput {
  return {
    tenantId,
    templateId,
    fieldKey: f.fieldKey,
    label: f.label,
    helpText: f.helpText ?? null,
    inputType: f.inputType,
    options: f.options ?? [],
    optionStyle: f.optionStyle ?? null,
    required: f.required,
    sortOrder: f.sortOrder,
    systemField: f.systemField ?? null,
    fillMode: f.fillMode ?? 'CUSTOMER',
    showInInquiryList: Boolean(f.showInInquiryList),
  };
}

/** 기존 템플릿에 카탈로그에 추가된 필드만 멱등 보강 */
async function syncAirconOrderFormTemplateFields(
  db: Db,
  tenantId: string,
  templateId: string,
): Promise<void> {
  const existing = await db.orderFormTemplateField.findMany({
    where: { tenantId, templateId },
    select: { fieldKey: true, sortOrder: true, systemField: true },
  });
  const keySet = new Set(existing.map((r) => r.fieldKey));
  const missing = AIRCON_ORDER_FORM_TEMPLATE_FIELDS.filter((f) => !keySet.has(f.fieldKey));
  if (missing.length > 0) {
    await db.orderFormTemplateField.createMany({
      data: missing.map((f) => fieldSeedToCreateMany(tenantId, templateId, f)),
    });
  }

  for (const seed of AIRCON_ORDER_FORM_TEMPLATE_FIELDS) {
    const row = existing.find((r) => r.fieldKey === seed.fieldKey);
    if (!row) continue;
    await db.orderFormTemplateField.updateMany({
      where: { tenantId, templateId, fieldKey: seed.fieldKey },
      data: {
        label: seed.label,
        helpText: seed.helpText ?? null,
        inputType: seed.inputType,
        options: seed.options ?? [],
        optionStyle: seed.optionStyle ?? null,
        required: seed.required,
        sortOrder: seed.sortOrder,
        systemField: seed.systemField ?? null,
        fillMode: seed.fillMode ?? 'CUSTOMER',
        showInInquiryList: Boolean(seed.showInInquiryList),
      },
    });
  }

  await db.orderFormTemplateField.deleteMany({
    where: {
      tenantId,
      templateId,
      fieldKey: { in: [...AIRCON_ORDER_FORM_REMOVED_FIELD_KEYS] },
    },
  });
}

/** 테넌트에 플랫폼 공통 에어컨 청소 발주서가 없으면 생성·있으면 필드 보강(멱등) */
export async function ensureAirconOrderFormTemplate(db: Db, tenantId: string): Promise<void> {
  const existing = await db.orderFormTemplate.findFirst({
    where: {
      tenantId,
      isDefault: false,
      title: AIRCON_ORDER_FORM_TEMPLATE_TITLE,
    },
    select: { id: true },
  });
  if (existing) {
    await db.orderFormTemplate.update({
      where: { id: existing.id },
      data: { description: AIRCON_ORDER_FORM_TEMPLATE_DESCRIPTION },
    });
    await syncAirconOrderFormTemplateFields(db, tenantId, existing.id);
    return;
  }

  const created = await db.orderFormTemplate.create({
    data: {
      tenantId,
      title: AIRCON_ORDER_FORM_TEMPLATE_TITLE,
      icon: AIRCON_ORDER_FORM_TEMPLATE_ICON,
      description: AIRCON_ORDER_FORM_TEMPLATE_DESCRIPTION,
      status: 'PUBLISHED',
      renderMode: 'TEMPLATE',
      version: 1,
      isDefault: false,
      sortOrder: AIRCON_ORDER_FORM_TEMPLATE_SORT_ORDER,
    },
  });

  await db.orderFormTemplateField.createMany({
    data: AIRCON_ORDER_FORM_TEMPLATE_FIELDS.map((f) =>
      fieldSeedToCreateMany(tenantId, created.id, f),
    ),
  });
}
