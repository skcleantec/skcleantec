import type { OutboundEmailPurpose } from '../../lib/outboundEmailPurpose.js';
import { applyPlatformEmailTemplatePlaceholders } from '../../lib/platformEmailTemplatePlaceholders.js';
import {
  wrapPlatformCustomerEmailHtml,
  wrapPlatformCustomerEmailPlainText,
} from '../../lib/platformCustomerEmailLayout.js';
import {
  buildOrderFormSubmissionEmailDynamicHtml,
  buildOrderFormSubmissionEmailDynamicPlainText,
  buildOrderFormSubmissionEmailHtml,
  buildOrderFormSubmissionEmailPlainText,
  buildOrderFormSubmissionEmailSubject,
  type OrderFormSubmissionEmailContentInput,
} from '../orderform/orderFormSubmissionEmail.content.js';
import {
  buildInspectionCompletionEmailDynamicHtml,
  buildInspectionCompletionEmailDynamicPlainText,
  buildInspectionCompletionEmailHtml,
  buildInspectionCompletionEmailPlainText,
  type InspectionCompletionEmailContentOptions,
} from '../inquiry-inspection/inquiryInspection.report.js';
import type { inspectionChecklistInclude } from '../inquiry-inspection/inquiryInspection.include.js';
import type { Prisma } from '@prisma/client';
import {
  loadActivePlatformEmailTemplate,
  resolveTemplateFields,
  type PlatformEmailTemplatePublic,
} from './platformEmailTemplate.service.js';

type ChecklistRow = Prisma.InquiryInspectionChecklistGetPayload<{
  include: typeof inspectionChecklistInclude;
}>;

export type PlatformEmailTemplateVars = {
  customerName: string;
  brandDisplayName: string;
  inquiryNumber: string;
  serviceDate: string;
  address: string;
  teamLeaderName: string;
};

function baseVars(input: {
  customerName: string;
  brandDisplayName: string;
  inquiryNumber?: string | null;
}): PlatformEmailTemplateVars {
  return {
    customerName: input.customerName.trim() || '고객',
    brandDisplayName: input.brandDisplayName.trim() || '청소비서',
    inquiryNumber: input.inquiryNumber?.trim() ?? '',
    serviceDate: '',
    address: '',
    teamLeaderName: '',
  };
}

function applyTemplateStrings(template: PlatformEmailTemplatePublic, vars: PlatformEmailTemplateVars) {
  const map: Record<string, string> = { ...vars };
  return {
    subject: applyPlatformEmailTemplatePlaceholders(template.subjectTemplate, map).slice(0, 500),
    headline: applyPlatformEmailTemplatePlaceholders(template.headline, map),
    preheader: template.preheader
      ? applyPlatformEmailTemplatePlaceholders(template.preheader, map)
      : null,
    introHtml: applyPlatformEmailTemplatePlaceholders(template.introHtml, map),
    footerHtml: applyPlatformEmailTemplatePlaceholders(template.footerHtml, map),
    noreplyNoticeHtml: applyPlatformEmailTemplatePlaceholders(template.noreplyNoticeHtml, map),
  };
}

export async function buildOrderFormSubmissionEmailContent(
  input: OrderFormSubmissionEmailContentInput,
): Promise<{ subject: string; html: string; text: string; usedTemplate: boolean }> {
  const active = await loadActivePlatformEmailTemplate('ORDER_FORM_SUBMISSION');
  if (!active) {
    return {
      subject: buildOrderFormSubmissionEmailSubject(input),
      html: buildOrderFormSubmissionEmailHtml(input),
      text: buildOrderFormSubmissionEmailPlainText(input),
      usedTemplate: false,
    };
  }

  const template = resolveTemplateFields('ORDER_FORM_SUBMISSION', active);
  const vars = baseVars(input);
  const applied = applyTemplateStrings(template, vars);
  const dynamicHtml = buildOrderFormSubmissionEmailDynamicHtml(input);
  const dynamicPlain = buildOrderFormSubmissionEmailDynamicPlainText(input);

  return {
    subject: applied.subject,
    html: wrapPlatformCustomerEmailHtml({
      subject: applied.subject,
      preheader: applied.preheader,
      headline: applied.headline,
      introHtml: applied.introHtml,
      dynamicHtml,
      footerHtml: applied.footerHtml,
      noreplyNoticeHtml: applied.noreplyNoticeHtml,
    }),
    text: wrapPlatformCustomerEmailPlainText({
      headline: applied.headline,
      introHtml: applied.introHtml,
      dynamicPlain,
      footerHtml: applied.footerHtml,
      noreplyNoticeHtml: applied.noreplyNoticeHtml,
    }),
    usedTemplate: true,
  };
}

export async function buildInspectionCompletionEmailContent(params: {
  tenantDisplayName: string;
  row: ChecklistRow;
  inquiry: {
    customerName: string;
    inquiryNumber: string | null;
    preferredDate: Date | null;
    address: string;
  };
  opts?: InspectionCompletionEmailContentOptions;
}): Promise<{ subject: string; html: string; text: string; usedTemplate: boolean }> {
  const active = await loadActivePlatformEmailTemplate('INSPECTION_COMPLETION');
  const contentOpts = params.opts ?? {};

  if (!active) {
    return {
      subject: `[${params.tenantDisplayName}] ${params.inquiry.customerName}님 현장 검수 체크리스트 완료본`,
      html: buildInspectionCompletionEmailHtml(params.row, params.inquiry, contentOpts),
      text: buildInspectionCompletionEmailPlainText(params.row, params.inquiry, contentOpts),
      usedTemplate: false,
    };
  }

  const template = resolveTemplateFields('INSPECTION_COMPLETION', active);
  const vars: PlatformEmailTemplateVars = {
    ...baseVars({
      customerName: params.inquiry.customerName,
      brandDisplayName: params.tenantDisplayName,
      inquiryNumber: params.inquiry.inquiryNumber,
    }),
    serviceDate: params.inquiry.preferredDate?.toISOString().slice(0, 10) ?? '—',
    address: params.inquiry.address ?? '',
    teamLeaderName: params.row.teamLeader.name ?? '',
  };
  const applied = applyTemplateStrings(template, vars);
  const dynamicHtml = buildInspectionCompletionEmailDynamicHtml(
    params.row,
    params.inquiry,
    contentOpts,
  );
  const dynamicPlain = buildInspectionCompletionEmailDynamicPlainText(
    params.row,
    params.inquiry,
    contentOpts,
  );

  return {
    subject: applied.subject,
    html: wrapPlatformCustomerEmailHtml({
      subject: applied.subject,
      preheader: applied.preheader,
      headline: applied.headline,
      introHtml: applied.introHtml,
      dynamicHtml,
      footerHtml: applied.footerHtml,
      noreplyNoticeHtml: applied.noreplyNoticeHtml,
    }),
    text: wrapPlatformCustomerEmailPlainText({
      headline: applied.headline,
      introHtml: applied.introHtml,
      dynamicPlain,
      footerHtml: applied.footerHtml,
      noreplyNoticeHtml: applied.noreplyNoticeHtml,
    }),
    usedTemplate: true,
  };
}

export function listPlatformEmailTemplatePurposeMeta(): Array<{
  purpose: OutboundEmailPurpose;
  label: string;
}> {
  return [
    { purpose: 'ORDER_FORM_SUBMISSION', label: '발주서 제출 확인' },
    { purpose: 'INSPECTION_COMPLETION', label: '현장검수 완료본' },
  ];
}
