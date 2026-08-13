import type { PlatformEmailTemplate } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import {
  CUSTOMER_OUTBOUND_EMAIL_PURPOSES,
  isCustomerOutboundEmailPurpose,
  type CustomerOutboundEmailPurpose,
} from '../../lib/outboundEmailPurpose.js';
import { stripDangerousHtml } from '../help-cms/helpCms.helpers.js';
import {
  getPlatformEmailTemplateDefaults,
  PLATFORM_EMAIL_TEMPLATE_DEFAULTS,
} from './platformEmailTemplate.defaults.js';

export type PlatformEmailTemplatePublic = {
  purpose: CustomerOutboundEmailPurpose;
  label: string;
  enabled: boolean;
  subjectTemplate: string;
  headline: string;
  preheader: string | null;
  introHtml: string;
  footerHtml: string;
  noreplyNoticeHtml: string;
  updatedAt: string;
  updatedByEmail: string | null;
  isConfigured: boolean;
};

export type PlatformEmailTemplatePatchInput = {
  label?: string;
  enabled?: boolean;
  subjectTemplate?: string;
  headline?: string;
  preheader?: string | null;
  introHtml?: string;
  footerHtml?: string;
  noreplyNoticeHtml?: string;
};

function serialize(row: PlatformEmailTemplate): PlatformEmailTemplatePublic {
  const purpose = row.purpose as CustomerOutboundEmailPurpose;
  return {
    purpose,
    label: row.label,
    enabled: row.enabled,
    subjectTemplate: row.subjectTemplate,
    headline: row.headline,
    preheader: row.preheader,
    introHtml: row.introHtml,
    footerHtml: row.footerHtml,
    noreplyNoticeHtml: row.noreplyNoticeHtml,
    updatedAt: row.updatedAt.toISOString(),
    updatedByEmail: row.updatedByEmail,
    isConfigured: true,
  };
}

function defaultsPublic(purpose: CustomerOutboundEmailPurpose): PlatformEmailTemplatePublic {
  const d = getPlatformEmailTemplateDefaults(purpose);
  return {
    purpose,
    label: d.label,
    enabled: true,
    subjectTemplate: d.subjectTemplate,
    headline: d.headline,
    preheader: d.preheader,
    introHtml: d.introHtml,
    footerHtml: d.footerHtml,
    noreplyNoticeHtml: d.noreplyNoticeHtml,
    updatedAt: new Date(0).toISOString(),
    updatedByEmail: null,
    isConfigured: false,
  };
}

export async function listPlatformEmailTemplates(): Promise<PlatformEmailTemplatePublic[]> {
  const rows = await prisma.platformEmailTemplate.findMany({
    orderBy: { purpose: 'asc' },
  });
  const byPurpose = new Map(rows.map((r) => [r.purpose, r]));
  return CUSTOMER_OUTBOUND_EMAIL_PURPOSES.map((purpose) => {
    const row = byPurpose.get(purpose);
    return row ? serialize(row) : defaultsPublic(purpose);
  });
}

export async function getPlatformEmailTemplate(
  purposeRaw: string,
): Promise<PlatformEmailTemplatePublic | null> {
  if (!isCustomerOutboundEmailPurpose(purposeRaw)) return null;
  const row = await prisma.platformEmailTemplate.findUnique({ where: { purpose: purposeRaw } });
  return row ? serialize(row) : defaultsPublic(purposeRaw);
}

/** 발송용 — enabled=false 또는 미존재 시 null */
export async function loadActivePlatformEmailTemplate(
  purpose: CustomerOutboundEmailPurpose,
): Promise<PlatformEmailTemplatePublic | null> {
  const row = await prisma.platformEmailTemplate.findUnique({ where: { purpose } });
  if (!row || !row.enabled) return null;
  return serialize(row);
}

export function resolveTemplateFields(
  purpose: CustomerOutboundEmailPurpose,
  row: PlatformEmailTemplatePublic | null,
): PlatformEmailTemplatePublic {
  if (row?.isConfigured && row.enabled) return row;
  const d = getPlatformEmailTemplateDefaults(purpose);
  return {
    purpose,
    label: d.label,
    enabled: true,
    subjectTemplate: d.subjectTemplate,
    headline: d.headline,
    preheader: d.preheader,
    introHtml: d.introHtml,
    footerHtml: d.footerHtml,
    noreplyNoticeHtml: d.noreplyNoticeHtml,
    updatedAt: row?.updatedAt ?? new Date(0).toISOString(),
    updatedByEmail: row?.updatedByEmail ?? null,
    isConfigured: Boolean(row?.isConfigured),
  };
}

function sanitizeHtmlField(raw: string): string {
  return stripDangerousHtml(raw.trim());
}

export async function upsertPlatformEmailTemplate(
  purposeRaw: string,
  input: PlatformEmailTemplatePatchInput,
  updatedByEmail: string | null,
): Promise<PlatformEmailTemplatePublic> {
  if (!isCustomerOutboundEmailPurpose(purposeRaw)) {
    throw new Error('지원하지 않는 메일 유형입니다.');
  }
  const defaults = PLATFORM_EMAIL_TEMPLATE_DEFAULTS[purposeRaw];
  const existing = await prisma.platformEmailTemplate.findUnique({ where: { purpose: purposeRaw } });

  const data = {
    label: input.label?.trim() || existing?.label || defaults.label,
    enabled: input.enabled ?? existing?.enabled ?? true,
    subjectTemplate: (input.subjectTemplate ?? existing?.subjectTemplate ?? defaults.subjectTemplate).trim().slice(0, 500),
    headline: (input.headline ?? existing?.headline ?? defaults.headline).trim().slice(0, 128),
    preheader:
      input.preheader !== undefined
        ? input.preheader?.trim().slice(0, 256) ?? null
        : existing?.preheader ?? defaults.preheader,
    introHtml: sanitizeHtmlField(input.introHtml ?? existing?.introHtml ?? defaults.introHtml),
    footerHtml: sanitizeHtmlField(input.footerHtml ?? existing?.footerHtml ?? defaults.footerHtml),
    noreplyNoticeHtml: sanitizeHtmlField(
      input.noreplyNoticeHtml ?? existing?.noreplyNoticeHtml ?? defaults.noreplyNoticeHtml,
    ),
    updatedByEmail: updatedByEmail?.trim() || null,
  };

  if (!data.subjectTemplate) throw new Error('제목을 입력해 주세요.');
  if (!data.headline) throw new Error('메일 제목(헤드라인)을 입력해 주세요.');
  if (!data.introHtml) throw new Error('본문 인트로를 입력해 주세요.');

  const row = existing
    ? await prisma.platformEmailTemplate.update({ where: { purpose: purposeRaw }, data })
    : await prisma.platformEmailTemplate.create({
        data: { purpose: purposeRaw, ...data },
      });
  return serialize(row);
}
