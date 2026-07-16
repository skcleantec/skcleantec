import type { Prisma, PrismaClient } from '@prisma/client';
import { Prisma as PrismaNamespace } from '@prisma/client';
import {
  formatOrderFormListSnapshotValue,
  ORDER_FORM_INQUIRY_LIST_PROMOTED_MAX,
  type OrderFormListSnapshot,
  type OrderFormPromotedListFieldDef,
} from '../../lib/orderFormListSnapshot.js';

type Db = PrismaClient | Prisma.TransactionClient;

const LIST_PROMOTABLE_INPUT_TYPES = new Set(['TEXT', 'SELECT', 'NUMBER', 'MULTISELECT']);

export class OrderFormPromotedFieldLimitError extends Error {
  constructor(message = `접수 목록 노출 항목은 테넌트당 최대 ${ORDER_FORM_INQUIRY_LIST_PROMOTED_MAX}개입니다.`) {
    super(message);
    this.name = 'OrderFormPromotedFieldLimitError';
  }
}

export function canPromoteFieldToInquiryList(input: {
  systemField: string | null;
  inputType: string;
}): boolean {
  return !input.systemField?.trim() && LIST_PROMOTABLE_INPUT_TYPES.has(input.inputType);
}

export function buildOrderFormListSnapshot(
  promotedFields: OrderFormPromotedListFieldDef[],
  answers: Record<string, unknown>,
): OrderFormListSnapshot | null {
  const out: OrderFormListSnapshot = {};
  for (const f of promotedFields) {
    const value = formatOrderFormListSnapshotValue(answers[f.fieldKey]);
    if (value) out[f.fieldKey] = { label: f.label, value };
  }
  return Object.keys(out).length > 0 ? out : null;
}

export async function loadPromotedFieldsForTemplate(
  db: Db,
  tenantId: string,
  templateId: string | null | undefined,
): Promise<OrderFormPromotedListFieldDef[]> {
  if (!templateId?.trim()) return [];
  const rows = await db.orderFormTemplateField.findMany({
    where: {
      tenantId,
      templateId: templateId.trim(),
      showInInquiryList: true,
      systemField: null,
    },
    orderBy: { sortOrder: 'asc' },
    select: { fieldKey: true, label: true, inputType: true },
  });
  return rows
    .filter((r) => LIST_PROMOTABLE_INPUT_TYPES.has(r.inputType))
    .map((r) => ({ fieldKey: r.fieldKey, label: r.label }));
}

export async function listTenantPromotedListFields(
  db: Db,
  tenantId: string,
): Promise<OrderFormPromotedListFieldDef[]> {
  const rows = await db.orderFormTemplateField.findMany({
    where: {
      tenantId,
      showInInquiryList: true,
      systemField: null,
    },
    orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    select: { fieldKey: true, label: true, inputType: true },
  });
  const seen = new Set<string>();
  const out: OrderFormPromotedListFieldDef[] = [];
  for (const r of rows) {
    if (!LIST_PROMOTABLE_INPUT_TYPES.has(r.inputType)) continue;
    if (seen.has(r.fieldKey)) continue;
    seen.add(r.fieldKey);
    out.push({ fieldKey: r.fieldKey, label: r.label });
    if (out.length >= ORDER_FORM_INQUIRY_LIST_PROMOTED_MAX) break;
  }
  return out;
}

/** 템플릿 저장 시 테넌트 전체 목록 노출 fieldKey 상한 검증 */
export async function assertTenantPromotedFieldLimit(
  db: Db,
  tenantId: string,
  templateId: string,
  nextFields: Array<{ fieldKey: string; showInInquiryList?: boolean; systemField?: string | null; inputType?: string }>,
): Promise<void> {
  const otherKeys = await db.orderFormTemplateField.findMany({
    where: {
      tenantId,
      showInInquiryList: true,
      systemField: null,
      templateId: { not: templateId },
    },
    select: { fieldKey: true, inputType: true },
  });
  const keys = new Set<string>();
  for (const r of otherKeys) {
    if (LIST_PROMOTABLE_INPUT_TYPES.has(r.inputType)) keys.add(r.fieldKey);
  }
  for (const f of nextFields) {
    if (!f.showInInquiryList) continue;
    if (!canPromoteFieldToInquiryList({ systemField: f.systemField ?? null, inputType: f.inputType ?? 'TEXT' })) {
      continue;
    }
    keys.add(f.fieldKey.trim());
  }
  if (keys.size > ORDER_FORM_INQUIRY_LIST_PROMOTED_MAX) {
    throw new OrderFormPromotedFieldLimitError();
  }
}

export async function resolveOrderFormListSnapshotForSubmit(
  db: Db,
  tenantId: string,
  templateId: string | null | undefined,
  answers: Record<string, unknown>,
): Promise<OrderFormListSnapshot | null> {
  const promoted = await loadPromotedFieldsForTemplate(db, tenantId, templateId);
  return buildOrderFormListSnapshot(promoted, answers);
}

export function orderFormListSnapshotToPrisma(
  snapshot: OrderFormListSnapshot | null,
): Prisma.InputJsonValue | typeof PrismaNamespace.DbNull {
  if (!snapshot || Object.keys(snapshot).length === 0) return PrismaNamespace.DbNull;
  return snapshot as Prisma.InputJsonValue;
}
