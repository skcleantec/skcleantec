import type { Prisma, PrismaClient } from '@prisma/client';
import type { InquiryIntakeFormProfile } from '../../lib/inquiryFormProfile.js';
import {
  isOrderFormSectionOffOptions,
  isOrderFormSectionToggleKey,
} from '../../lib/orderFormSectionToggles.js';
import {
  getPublicTemplateForForm,
  sanitizeCustomAnswers,
} from '../orderform-templates/orderFormTemplate.service.js';
import {
  orderFormListSnapshotToPrisma,
  resolveOrderFormListSnapshotForSubmit,
} from '../orderform/orderFormListSnapshot.service.js';
import {
  applyTenantInquiryIntakeOverlay,
  readTenantInquiryIntakeKeys,
} from './inquiryIntakeFields.service.js';

type Db = PrismaClient | Prisma.TransactionClient;

const EMPTY_PROFILE: InquiryIntakeFormProfile = {
  templateId: null,
  title: '기본 발주서',
  icon: null,
  isDefault: true,
  renderMode: 'STANDARD',
  systemFieldKeys: [],
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
    const def = await db.orderFormTemplate.findFirst({
      where: { tenantId, isDefault: true },
      select: { id: true },
    });
    templateId = def?.id ?? null;
  }
  const pub = await getPublicTemplateForForm(db, tenantId, templateId);
  const tenantKeys = await readTenantInquiryIntakeKeys(db, tenantId);
  if (!pub) {
    return applyTenantInquiryIntakeOverlay(
      {
        ...EMPTY_PROFILE,
        canEditCustomAnswers: Boolean(input.orderFormId),
        orderFormId: input.orderFormId ?? null,
        orderFormSubmitted: Boolean(input.submittedAt),
      },
      tenantKeys,
    );
  }
  return applyTenantInquiryIntakeOverlay(
    {
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
      canEditCustomAnswers: Boolean(input.orderFormId),
      orderFormId: input.orderFormId ?? null,
      orderFormSubmitted: Boolean(input.submittedAt),
    },
    tenantKeys,
  );
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
