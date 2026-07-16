import type { Prisma, PrismaClient } from '@prisma/client';
import {
  AIRCON_ORDER_FORM_TEMPLATE_DESCRIPTION,
  AIRCON_ORDER_FORM_TEMPLATE_FIELDS,
  AIRCON_ORDER_FORM_TEMPLATE_ICON,
  AIRCON_ORDER_FORM_TEMPLATE_SORT_ORDER,
  AIRCON_ORDER_FORM_TEMPLATE_TITLE,
} from './airconOrderFormTemplate.catalog.js';

type Db = PrismaClient | Prisma.TransactionClient;

/** 테넌트에 플랫폼 공통 에어컨 청소 발주서가 없으면 생성(멱등) */
export async function ensureAirconOrderFormTemplate(db: Db, tenantId: string): Promise<void> {
  const existing = await db.orderFormTemplate.findFirst({
    where: {
      tenantId,
      isDefault: false,
      title: AIRCON_ORDER_FORM_TEMPLATE_TITLE,
    },
    select: { id: true },
  });
  if (existing) return;

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
    data: AIRCON_ORDER_FORM_TEMPLATE_FIELDS.map((f) => ({
      tenantId,
      templateId: created.id,
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
    })),
  });
}
