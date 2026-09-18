import type { Prisma, PrismaClient } from '@prisma/client';
import type { InquiryIntakeFormProfile, PublishedIntakeTemplateOption } from '../../lib/inquiryFormProfile.js';
import {
  isOrderFormSectionOffOptions,
  isOrderFormSectionToggleKey,
} from '../../lib/orderFormSectionToggles.js';
import { INTAKE_IDENTITY_FIELD_KEYS } from '../../lib/inquiryIntakeFields.js';
import {
  getPublicTemplateForForm,
  sanitizeCustomAnswers,
} from '../orderform-templates/orderFormTemplate.service.js';
import {
  orderFormListSnapshotToPrisma,
  resolveOrderFormListSnapshotForSubmit,
} from '../orderform/orderFormListSnapshot.service.js';

type Db = PrismaClient | Prisma.TransactionClient;

const EMPTY_PROFILE: InquiryIntakeFormProfile = {
  templateId: null,
  title: '발주서 없음',
  icon: null,
  isDefault: false,
  renderMode: 'TEMPLATE',
  systemFieldKeys: [...INTAKE_IDENTITY_FIELD_KEYS],
  sectionOffKeys: [],
  customFields: [],
  canEditCustomAnswers: false,
  orderFormId: null,
  orderFormSubmitted: false,
};

function jsonObject(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return { ...(raw as Record<string, unknown>) };
}

export async function listPublishedIntakeTemplates(
  db: Db,
  tenantId: string,
): Promise<PublishedIntakeTemplateOption[]> {
  const rows = await db.orderFormTemplate.findMany({
    where: { tenantId, status: 'PUBLISHED' },
    orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, title: true, icon: true, isDefault: true },
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    icon: row.icon,
    isDefault: row.isDefault,
  }));
}

/** 사용함 양식만. 지정분이 없거나 꺼져 있으면 기본 → 목록 첫 장. */
export async function resolvePublishedIntakeTemplateId(
  db: Db,
  tenantId: string,
  requestedId?: string | null,
): Promise<{ id: string } | null | 'invalid'> {
  const tid = typeof requestedId === 'string' ? requestedId.trim() : '';
  if (tid) {
    const row = await db.orderFormTemplate.findFirst({
      where: { id: tid, tenantId, status: 'PUBLISHED' },
      select: { id: true },
    });
    return row ? { id: row.id } : 'invalid';
  }
  const publishedDefault = await db.orderFormTemplate.findFirst({
    where: { tenantId, isDefault: true, status: 'PUBLISHED' },
    select: { id: true },
  });
  if (publishedDefault) return { id: publishedDefault.id };
  const first = await db.orderFormTemplate.findFirst({
    where: { tenantId, status: 'PUBLISHED' },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: { id: true },
  });
  return first ? { id: first.id } : null;
}

export async function loadInquiryIntakeFormProfile(
  db: Db,
  tenantId: string,
  input: {
    orderFormId?: string | null;
    templateId?: string | null;
    submittedAt?: Date | null;
  } = {},
): Promise<InquiryIntakeFormProfile> {
  let templateId = input.templateId?.trim() || null;
  if (!templateId) {
    const resolved = await resolvePublishedIntakeTemplateId(db, tenantId, null);
    templateId = resolved && resolved !== 'invalid' ? resolved.id : null;
  }
  if (!templateId) {
    return {
      ...EMPTY_PROFILE,
      canEditCustomAnswers: Boolean(input.orderFormId),
      orderFormId: input.orderFormId ?? null,
      orderFormSubmitted: Boolean(input.submittedAt),
    };
  }
  const pub = await getPublicTemplateForForm(db, tenantId, templateId);
  if (!pub) {
    return {
      ...EMPTY_PROFILE,
      canEditCustomAnswers: Boolean(input.orderFormId),
      orderFormId: input.orderFormId ?? null,
      orderFormSubmitted: Boolean(input.submittedAt),
    };
  }
  return {
    templateId: pub.id,
    title: pub.title,
    icon: pub.icon,
    isDefault: pub.isDefault,
    renderMode: pub.renderMode,
    systemFieldKeys: pub.systemFields.map((f) => f.systemField),
    sectionOffKeys: pub.systemFields
      .filter((f) => isOrderFormSectionToggleKey(f.systemField) && isOrderFormSectionOffOptions(f.options))
      .map((f) => f.systemField),
    customFields: pub.customFields.map((f) => ({
      fieldKey: f.fieldKey,
      label: f.label,
      helpText: f.helpText,
      inputType: f.inputType,
      options: Array.isArray(f.options) ? f.options.map((o) => String(o)) : [],
      placeholder: f.placeholder,
      optionStyle: f.optionStyle,
      optionLayout: f.optionLayout,
      required: f.required,
    })),
    canEditCustomAnswers: pub.customFields.length > 0 || Boolean(input.orderFormId),
    orderFormId: input.orderFormId ?? null,
    orderFormSubmitted: Boolean(input.submittedAt),
  };
}

/**
 * 접수 수정에서 고친 커스텀 칸을 발주서에 다시 쓴다.
 * 제출 전: prefillAnswers(+ customerAnswers 표시용) — 고객 링크가 같은 값을 봄.
 * 제출 후: customerAnswers — 고객 제출본과 같은 저장소.
 * 스냅샷·시스템 컬럼은 건드리지 않는다.
 */
export async function syncOrderFormCustomAnswersFromInquiryPatch(
  tx: Prisma.TransactionClient,
  input: {
    tenantId: string;
    orderFormId: string;
    answers: unknown;
  },
): Promise<void> {
  const form = await tx.orderForm.findFirst({
    where: { id: input.orderFormId, tenantId: input.tenantId },
    select: {
      id: true,
      templateId: true,
      submittedAt: true,
      customerAnswers: true,
      prefillAnswers: true,
    },
  });
  if (!form) return;

  const profile = await loadInquiryIntakeFormProfile(tx, input.tenantId, {
    orderFormId: form.id,
    templateId: form.templateId,
    submittedAt: form.submittedAt,
  });
  const pub = await getPublicTemplateForForm(tx, input.tenantId, form.templateId);
  const sanitized = sanitizeCustomAnswers(input.answers, pub?.customFields ?? []);

  const rawBody = input.answers && typeof input.answers === 'object' && !Array.isArray(input.answers)
    ? (input.answers as Record<string, unknown>)
    : {};
  const prevAnswers = jsonObject(form.customerAnswers);
  const nextAnswers = { ...prevAnswers };
  for (const field of profile.customFields) {
    const key = field.fieldKey;
    if (Object.prototype.hasOwnProperty.call(sanitized, key)) {
      nextAnswers[key] = sanitized[key];
    } else if (Object.prototype.hasOwnProperty.call(rawBody, key)) {
      delete nextAnswers[key];
    }
  }

  const snapshot = await resolveOrderFormListSnapshotForSubmit(
    tx,
    input.tenantId,
    form.templateId,
    nextAnswers,
  );

  let prefillAnswers: Prisma.InputJsonValue | undefined;
  if (!form.submittedAt) {
    const prevPrefill = jsonObject(form.prefillAnswers);
    const nextPrefill = { ...prevPrefill };
    for (const field of profile.customFields) {
      const key = field.fieldKey;
      if (Object.prototype.hasOwnProperty.call(nextAnswers, key)) {
        nextPrefill[key] = nextAnswers[key];
      } else if (Object.prototype.hasOwnProperty.call(rawBody, key)) {
        delete nextPrefill[key];
      }
    }
    prefillAnswers = nextPrefill as Prisma.InputJsonValue;
  }

  await tx.orderForm.update({
    where: { id: form.id },
    data: {
      customerAnswers: nextAnswers as Prisma.InputJsonValue,
      ...(prefillAnswers !== undefined ? { prefillAnswers } : {}),
    },
  });

  await tx.inquiry.updateMany({
    where: { tenantId: input.tenantId, orderFormId: form.id },
    data: { orderFormListSnapshot: orderFormListSnapshotToPrisma(snapshot) },
  });
}

export function parseOrderFormAnswersBody(raw: unknown): Record<string, unknown> | undefined {
  if (raw == null) return undefined;
  if (typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  return raw as Record<string, unknown>;
}
