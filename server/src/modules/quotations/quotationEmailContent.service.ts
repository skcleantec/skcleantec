import type { QuotationRow } from './quotations.service.js';
import {
  QUOTATION_DOCUMENT_TYPE_LABELS,
  type QuotationDocumentType,
} from './quotationDocument.js';
import { computeQuotationVatAmounts, vatModeLabel, type QuotationVatMode } from './quotationVat.js';

export const QUOTATION_EMAIL_PLACEHOLDER_HELP =
  '{{customerName}}, {{quoteNumber}}, {{total}}, {{companyName}}, {{validUntil}}, {{documentLabel}}';

const FALLBACK_SUBJECT_QUOTATION = '[{{companyName}}] 견적서 {{quoteNumber}} — {{customerName}}';
const FALLBACK_SUBJECT_RECEIPT = '[{{companyName}}] 영수증 {{quoteNumber}} — {{customerName}}';

const FALLBACK_BODY_QUOTATION =
  '{{customerName}} 고객님, 안녕하세요.\n\n' +
  '요청하신 견적서({{quoteNumber}})를 첨부드립니다.\n' +
  '합계: {{total}}원 (부가세 별도)\n\n' +
  '문의 사항이 있으시면 연락 주시기 바랍니다.\n\n' +
  '{{companyName}}';

const FALLBACK_BODY_RECEIPT =
  '{{customerName}} 고객님, 안녕하세요.\n\n' +
  '요청하신 영수증({{quoteNumber}})을 첨부드립니다.\n' +
  '합계: {{total}}원 (부가세 별도)\n\n' +
  '문의 사항이 있으시면 연락 주시기 바랍니다.\n\n' +
  '{{companyName}}';

export type QuotationEmailVars = {
  customerName: string;
  quoteNumber: string;
  total: string;
  companyName: string;
  validUntil: string;
  documentLabel: string;
};

function resolveDocumentType(quotation: QuotationRow): QuotationDocumentType {
  return (quotation.documentType ?? 'QUOTATION') as QuotationDocumentType;
}

function fallbackSubject(documentType: QuotationDocumentType): string {
  return documentType === 'RECEIPT' ? FALLBACK_SUBJECT_RECEIPT : FALLBACK_SUBJECT_QUOTATION;
}

function fallbackBody(documentType: QuotationDocumentType): string {
  return documentType === 'RECEIPT' ? FALLBACK_BODY_RECEIPT : FALLBACK_BODY_QUOTATION;
}

/** 업체 설정 템플릿에 「견적서」가 고정돼 있을 때 영수증 발송에 맞게 치환 */
function adaptEmailTemplateForDocumentType(
  template: string,
  documentType: QuotationDocumentType,
): string {
  if (documentType !== 'RECEIPT') return template;
  return template.replace(/견적서/g, '영수증');
}

export function buildQuotationEmailVars(
  quotation: QuotationRow,
  companyName: string,
): QuotationEmailVars {
  const documentType = resolveDocumentType(quotation);
  const vatMode = (quotation.vatMode ?? 'VAT_SEPARATE') as QuotationVatMode;
  const { grandTotal } = computeQuotationVatAmounts(quotation.total, vatMode);
  const totalLabel =
    vatMode === 'VAT_SEPARATE'
      ? `${grandTotal.toLocaleString('ko-KR')} (${vatModeLabel(vatMode)}, VAT 포함)`
      : `${grandTotal.toLocaleString('ko-KR')} (${vatModeLabel(vatMode)})`;
  return {
    customerName: quotation.customerName,
    quoteNumber: quotation.quoteNumber,
    total: totalLabel,
    companyName,
    validUntil: quotation.validUntil
      ? quotation.validUntil.toISOString().slice(0, 10)
      : '—',
    documentLabel: QUOTATION_DOCUMENT_TYPE_LABELS[documentType],
  };
}

export function applyQuotationEmailPlaceholders(
  template: string,
  vars: QuotationEmailVars,
): string {
  return template
    .replace(/\{\{customerName\}\}/g, vars.customerName)
    .replace(/\{\{quoteNumber\}\}/g, vars.quoteNumber)
    .replace(/\{\{total\}\}/g, vars.total)
    .replace(/\{\{companyName\}\}/g, vars.companyName)
    .replace(/\{\{validUntil\}\}/g, vars.validUntil)
    .replace(/\{\{documentLabel\}\}/g, vars.documentLabel);
}

function resolveTemplate(
  override: string | undefined | null,
  configVal: string | null | undefined,
  fallback: string,
): string {
  if (override !== undefined && override !== null) {
    const trimmed = override.trim();
    return trimmed || fallback;
  }
  const fromConfig = configVal?.trim();
  return fromConfig || fallback;
}

export function buildQuotationEmailContent(params: {
  quotation: QuotationRow;
  companyName: string;
  config?: { defaultEmailSubject?: string | null; defaultEmailBody?: string | null } | null;
  subjectOverride?: string | null;
  bodyOverride?: string | null;
}): { subject: string; body: string } {
  const documentType = resolveDocumentType(params.quotation);
  const vars = buildQuotationEmailVars(params.quotation, params.companyName);
  const subjectTemplate = adaptEmailTemplateForDocumentType(
    resolveTemplate(
      params.subjectOverride,
      params.config?.defaultEmailSubject,
      fallbackSubject(documentType),
    ),
    documentType,
  );
  const bodyTemplate = adaptEmailTemplateForDocumentType(
    resolveTemplate(
      params.bodyOverride,
      params.config?.defaultEmailBody,
      fallbackBody(documentType),
    ),
    documentType,
  );
  return {
    subject: applyQuotationEmailPlaceholders(subjectTemplate, vars).slice(0, 500),
    body: applyQuotationEmailPlaceholders(bodyTemplate, vars),
  };
}

export function previewBodyForLog(body: string, maxLen = 500): string {
  const t = body.trim();
  if (t.length <= maxLen) return t;
  return `${t.slice(0, maxLen)}…`;
}
