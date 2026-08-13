import type { CustomerOutboundEmailPurpose } from '../../lib/outboundEmailPurpose.js';
import { applyPlatformEmailTemplatePlaceholders } from '../../lib/platformEmailTemplatePlaceholders.js';
import {
  wrapPlatformCustomerEmailHtml,
  wrapPlatformCustomerEmailPlainText,
} from '../../lib/platformCustomerEmailLayout.js';
import {
  buildOrderFormSubmissionEmailDynamicHtml,
  buildOrderFormSubmissionEmailDynamicPlainText,
  type OrderFormSubmissionEmailContentInput,
} from '../orderform/orderFormSubmissionEmail.content.js';
import {
  buildInspectionCompletionEmailDynamicHtml,
  buildInspectionCompletionEmailDynamicPlainText,
  type InspectionCompletionEmailContentOptions,
} from '../inquiry-inspection/inquiryInspection.report.js';
import type { inspectionChecklistInclude } from '../inquiry-inspection/inquiryInspection.include.js';
import type { Prisma } from '@prisma/client';
import {
  getPlatformEmailTemplate,
  resolveTemplateFields,
  type PlatformEmailTemplatePatchInput,
  type PlatformEmailTemplatePublic,
} from './platformEmailTemplate.service.js';
import type { PlatformEmailTemplateVars } from './platformCustomerEmailRender.service.js';

type ChecklistRow = Prisma.InquiryInspectionChecklistGetPayload<{
  include: typeof inspectionChecklistInclude;
}>;

const PREVIEW_VARS: PlatformEmailTemplateVars = {
  customerName: '홍길동',
  brandDisplayName: '○○청소',
  inquiryNumber: 'SK2608010001',
  serviceDate: '2026-08-15',
  address: '서울특별시 강남구 테헤란로 123, 1502호',
  teamLeaderName: '김팀장',
};

const ORDER_FORM_SAMPLE: OrderFormSubmissionEmailContentInput = {
  brandDisplayName: PREVIEW_VARS.brandDisplayName,
  customerName: PREVIEW_VARS.customerName,
  inquiryNumber: PREVIEW_VARS.inquiryNumber,
  customerSubmissionSnapshot: null,
  fallback: {
    preferredDateYmd: PREVIEW_VARS.serviceDate,
    preferredTime: '오전 (09:00~12:00)',
    totalAmount: 350_000,
    depositAmount: 100_000,
    balanceAmount: 250_000,
  },
};

const INSPECTION_SAMPLE_OPTS: InspectionCompletionEmailContentOptions = {
  customerViewUrl: 'https://www.cbiseo.com/inspection/preview-sample',
  pdfUrl: 'https://www.cbiseo.com/inspection/preview-sample.pdf',
};

function buildInspectionPreviewRow(): ChecklistRow {
  return {
    id: 'preview',
    tenantId: 'preview',
    inquiryId: 'preview',
    teamLeaderId: 'preview',
    basicAnswersJson: {
      q1: { leader: true, customer: true },
      q2: { leader: true, customer: true },
      q3: { leader: true, customer: true },
      q4: { leader: true, customer: true },
    },
    leaderNotes: '미리보기용 샘플 특이사항입니다. 실제 발송 시 현장 검수 내용이 표시됩니다.',
    completedAt: new Date('2026-08-15T14:30:00+09:00'),
    teamLeader: { id: 'preview', name: PREVIEW_VARS.teamLeaderName },
    voidedBy: null,
    areas: [],
  } as unknown as ChecklistRow;
}

function mergePreviewTemplate(
  purpose: CustomerOutboundEmailPurpose,
  row: PlatformEmailTemplatePublic | null,
  override?: PlatformEmailTemplatePatchInput,
): PlatformEmailTemplatePublic {
  const base = resolveTemplateFields(purpose, row);
  if (!override) return { ...base, enabled: true };
  return {
    ...base,
    enabled: true,
    label: override.label?.trim() || base.label,
    subjectTemplate: override.subjectTemplate?.trim() || base.subjectTemplate,
    headline: override.headline?.trim() || base.headline,
    preheader:
      override.preheader !== undefined
        ? override.preheader?.trim() || null
        : base.preheader,
    introHtml: override.introHtml?.trim() || base.introHtml,
    footerHtml: override.footerHtml?.trim() || base.footerHtml,
    noreplyNoticeHtml: override.noreplyNoticeHtml?.trim() || base.noreplyNoticeHtml,
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

export async function buildPlatformEmailTemplatePreview(params: {
  purpose: CustomerOutboundEmailPurpose;
  override?: PlatformEmailTemplatePatchInput;
}): Promise<{ subject: string; html: string; text: string }> {
  const row = await getPlatformEmailTemplate(params.purpose);
  const template = mergePreviewTemplate(params.purpose, row, params.override);
  const applied = applyTemplateStrings(template, PREVIEW_VARS);

  if (params.purpose === 'ORDER_FORM_SUBMISSION') {
    const dynamicHtml = buildOrderFormSubmissionEmailDynamicHtml(ORDER_FORM_SAMPLE);
    const dynamicPlain = buildOrderFormSubmissionEmailDynamicPlainText(ORDER_FORM_SAMPLE);
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
    };
  }

  const rowSample = buildInspectionPreviewRow();
  const inquiry = {
    customerName: PREVIEW_VARS.customerName,
    inquiryNumber: PREVIEW_VARS.inquiryNumber,
    preferredDate: new Date(`${PREVIEW_VARS.serviceDate}T00:00:00+09:00`),
    address: PREVIEW_VARS.address,
  };
  const dynamicHtml = buildInspectionCompletionEmailDynamicHtml(
    rowSample,
    inquiry,
    INSPECTION_SAMPLE_OPTS,
  );
  const dynamicPlain = buildInspectionCompletionEmailDynamicPlainText(
    rowSample,
    inquiry,
    INSPECTION_SAMPLE_OPTS,
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
  };
}
