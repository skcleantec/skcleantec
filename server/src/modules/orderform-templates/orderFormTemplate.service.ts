import type { Prisma, PrismaClient } from '@prisma/client';
import {
  TELECRM_ORDER_FORM_QUOTE_BREAKDOWN_FIELD_KEY,
  TELECRM_ORDER_FORM_QUOTE_BREAKDOWN_FIELD_META,
} from '../../lib/telecrmConsultationQuote.js';

type Db = PrismaClient | Prisma.TransactionClient;

export interface PublicTemplateCustomField {
  fieldKey: string;
  label: string;
  helpText: string | null;
  inputType: string;
  options: unknown;
  /** 입력란 안 흐린 부연설명(TEXTAREA/TEXT) */
  placeholder: string | null;
  /** 단일 선택 표시 방식 — 'RADIO' | 'DROPDOWN'(기본) */
  optionStyle: string | null;
  required: boolean;
  fillMode: string;
}

export interface PublicSystemField {
  systemField: string;
  label: string;
  required: boolean;
  sortOrder: number;
  /** 선택지(건축물유형·신축구축 등 — 표준 컨트롤 옵션을 빌더에서 편집 가능) */
  options: string[];
}

export interface PublicOrderTemplate {
  id: string;
  title: string;
  icon: string | null;
  description: string | null;
  /** 테넌트 기본 발주서 여부 — 공개 페이지 제목은 기본 템플릿일 때 formConfig.formTitle을 따른다 */
  isDefault: boolean;
  /** 렌더 방식 — STANDARD: 표준 폼 전체 / TEMPLATE: 템플릿 항목만 */
  renderMode: 'STANDARD' | 'TEMPLATE';
  /** systemField 연결 항목 — 공개 폼의 선택 표준 섹션 표시/숨김 제어용 */
  systemFields: PublicSystemField[];
  /** systemField 미연결(추가 정보) 항목 — 공개 폼에서 동적 렌더 */
  customFields: PublicTemplateCustomField[];
}

/**
 * 발급 시 사용할 템플릿 결정.
 * - templateId 지정: 테넌트 소유 + PUBLISHED 만 허용
 * - 미지정: 테넌트 기본 템플릿(있으면)
 * 반환 null = 사용할 템플릿 없음(레거시처럼 발급), 'invalid' = 잘못된 지정.
 */
export async function resolveIssueTemplate(
  db: Db,
  tenantId: string,
  templateId?: string | null,
): Promise<{ id: string; version: number } | null | 'invalid'> {
  const tid = typeof templateId === 'string' ? templateId.trim() : '';
  if (tid) {
    const t = await db.orderFormTemplate.findFirst({
      where: { id: tid, tenantId, status: 'PUBLISHED' },
      select: { id: true, version: true },
    });
    return t ? { id: t.id, version: t.version } : 'invalid';
  }
  const def = await db.orderFormTemplate.findFirst({
    where: { tenantId, isDefault: true },
    select: { id: true, version: true },
  });
  return def ? { id: def.id, version: def.version } : null;
}

/** 공개 발주서 페이지용 — 추가 항목 포함 직렬화 */
export async function getPublicTemplateForForm(
  db: Db,
  tenantId: string,
  templateId: string | null | undefined,
): Promise<PublicOrderTemplate | null> {
  if (!templateId) return null;
  const t = await db.orderFormTemplate.findFirst({
    where: { id: templateId, tenantId },
    include: { fields: { orderBy: { sortOrder: 'asc' } } },
  });
  if (!t) return null;
  const customFields: PublicTemplateCustomField[] = t.fields
    .filter(
      (f) =>
        !f.systemField &&
        f.fillMode !== 'ADMIN_LOCKED' &&
        f.fieldKey !== TELECRM_ORDER_FORM_QUOTE_BREAKDOWN_FIELD_KEY,
    )
    .map((f) => ({
      fieldKey: f.fieldKey,
      label: f.label,
      helpText: f.helpText,
      inputType: f.inputType,
      options: f.options,
      placeholder: f.placeholder,
      optionStyle: f.optionStyle,
      required: f.required,
      fillMode: f.fillMode,
    }));
  const systemFields: PublicSystemField[] = t.fields
    .filter((f) => !!f.systemField)
    .map((f) => ({
      systemField: f.systemField as string,
      label: f.label,
      required: f.required,
      sortOrder: f.sortOrder,
      options: Array.isArray(f.options) ? (f.options as unknown[]).map((o) => String(o)) : [],
    }));
  return {
    id: t.id,
    title: t.title,
    icon: t.icon,
    description: t.description,
    isDefault: t.isDefault,
    renderMode: t.renderMode,
    systemFields,
    customFields,
  };
}

/** 제출 답변 정규화 — customFields 키만 남기고 문자열/배열로 정리 */
export function sanitizeCustomAnswers(
  raw: unknown,
  customFields: PublicTemplateCustomField[],
): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') return {};
  const allowed = new Map(customFields.map((f) => [f.fieldKey, f]));
  const src = raw as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, field] of allowed) {
    const v = src[key];
    if (v == null) continue;
    if (Array.isArray(v)) {
      out[key] = v.map((x) => String(x)).slice(0, 50);
    } else if (typeof v === 'boolean') {
      out[key] = v;
    } else {
      const s = String(v).trim();
      if (s) out[key] = s.slice(0, 2000);
    }
    void field;
  }
  return out;
}

/** 마케터 선입력 저장 — 커스텀 필드 키(관리자 전용 포함) */
export async function listTemplateCustomFieldKeysForPrefill(
  db: Db,
  tenantId: string,
  templateId: string | null | undefined,
): Promise<string[]> {
  if (!templateId) return [];
  const rows = await db.orderFormTemplateField.findMany({
    where: { tenantId, templateId, systemField: null },
    select: { fieldKey: true },
    orderBy: { sortOrder: 'asc' },
  });
  return rows.map((r) => r.fieldKey);
}

/** 제출 스냅샷·알림 — 고객 화면에 숨기는 관리자 전용 커스텀 필드 */
export async function listStaffOnlyCustomFieldsForSnapshot(
  db: Db,
  tenantId: string,
  templateId: string | null | undefined,
): Promise<PublicTemplateCustomField[]> {
  if (!templateId) return [];
  const rows = await db.orderFormTemplateField.findMany({
    where: {
      tenantId,
      templateId,
      systemField: null,
      OR: [
        { fillMode: 'ADMIN_LOCKED' },
        { fieldKey: TELECRM_ORDER_FORM_QUOTE_BREAKDOWN_FIELD_KEY },
      ],
    },
    orderBy: { sortOrder: 'asc' },
  });
  return rows.map((f) => ({
    fieldKey: f.fieldKey,
    label: f.label,
    helpText: f.helpText,
    inputType: f.inputType,
    options: f.options,
    placeholder: f.placeholder,
    optionStyle: f.optionStyle,
    required: f.required,
    fillMode: f.fillMode,
  }));
}

/** 텔레CRM 발주 연동 — 견적 내역 커스텀 필드가 없으면 템플릿 끝에 추가(idempotent). */
export async function ensureCrmQuoteBreakdownTemplateField(
  db: Db,
  tenantId: string,
  templateId: string,
): Promise<boolean> {
  const existing = await db.orderFormTemplateField.findFirst({
    where: {
      tenantId,
      templateId,
      fieldKey: TELECRM_ORDER_FORM_QUOTE_BREAKDOWN_FIELD_KEY,
    },
    select: { id: true, fillMode: true },
  });
  if (existing) {
    if (existing.fillMode !== 'ADMIN_LOCKED') {
      await db.orderFormTemplateField.update({
        where: { id: existing.id },
        data: { fillMode: 'ADMIN_LOCKED' },
      });
    }
    return false;
  }

  const maxSort = await db.orderFormTemplateField.aggregate({
    where: { tenantId, templateId },
    _max: { sortOrder: true },
  });
  const meta = TELECRM_ORDER_FORM_QUOTE_BREAKDOWN_FIELD_META;
  await db.orderFormTemplateField.create({
    data: {
      tenantId,
      templateId,
      fieldKey: meta.fieldKey,
      label: meta.label,
      helpText: meta.helpText,
      inputType: meta.inputType as Prisma.OrderFormTemplateFieldCreateInput['inputType'],
      options: [],
      placeholder: meta.placeholder,
      required: meta.required,
      sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
      systemField: null,
      fillMode: meta.fillMode as Prisma.OrderFormTemplateFieldCreateInput['fillMode'],
    },
  });
  return true;
}
