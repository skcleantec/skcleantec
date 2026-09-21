import type { Prisma, PrismaClient } from '@prisma/client';
import {
  ORDER_FORM_QUOTE_ALWAYS_ON_FIELD_KEYS,
  ORDER_FORM_SYSTEM_FIELDS,
} from './systemFields.js';

type Db = PrismaClient | Prisma.TransactionClient;

const QUOTE_TIME_OPTIONS = ['오전', '오후', '사이청소', '조율'];
const QUOTE_LABEL_OVERRIDE: Record<string, string> = {
  preferredTimeDetail: '구체적 시각',
};
const MONEY_KEYS = new Set(['totalAmount', 'depositAmount', 'balanceAmount']);

function quoteFieldCreateData(
  tenantId: string,
  templateId: string,
  key: (typeof ORDER_FORM_QUOTE_ALWAYS_ON_FIELD_KEYS)[number],
  sortOrder: number,
): Prisma.OrderFormTemplateFieldCreateManyInput {
  const def = ORDER_FORM_SYSTEM_FIELDS.find((f) => f.key === key);
  const isTime = key === 'preferredTime';
  return {
    tenantId,
    templateId,
    fieldKey: key,
    label: QUOTE_LABEL_OVERRIDE[key] ?? def?.label ?? key,
    inputType: (def?.inputType ?? 'TEXT') as Prisma.OrderFormTemplateFieldCreateManyInput['inputType'],
    options: isTime ? QUOTE_TIME_OPTIONS : [],
    optionStyle: isTime ? 'DROPDOWN' : null,
    required: isTime,
    sortOrder,
    systemField: key,
    fillMode: MONEY_KEYS.has(key) ? 'ADMIN_PREFILL' : 'CUSTOMER',
  };
}

/** 이미 있는 양식에 견적·희망시각 상세가 없으면 멱등 보강 */
export async function ensureTenantOrderFormQuoteFields(db: Db, tenantId: string): Promise<void> {
  const templates = await db.orderFormTemplate.findMany({
    where: { tenantId },
    select: {
      id: true,
      fields: { select: { fieldKey: true, systemField: true, sortOrder: true } },
    },
  });

  for (const t of templates) {
    const mapped = new Set(
      t.fields.flatMap((f) => [f.fieldKey, f.systemField].filter((k): k is string => !!k)),
    );
    const missing = ORDER_FORM_QUOTE_ALWAYS_ON_FIELD_KEYS.filter((k) => !mapped.has(k));
    if (missing.length === 0) continue;
    const maxSort = t.fields.reduce((m, f) => Math.max(m, f.sortOrder), -1);
    await db.orderFormTemplateField.createMany({
      data: missing.map((key, i) => quoteFieldCreateData(tenantId, t.id, key, maxSort + 1 + i)),
    });
  }
}
