import type { QuotationRow } from './quotations.service.js';

export const QUOTATION_EMAIL_PLACEHOLDER_HELP =
  '{{customerName}}, {{quoteNumber}}, {{total}}, {{companyName}}, {{validUntil}}';

const FALLBACK_SUBJECT = '[{{companyName}}] 견적서 {{quoteNumber}} — {{customerName}}';

const FALLBACK_BODY =
  '{{customerName}} 고객님, 안녕하세요.\n\n' +
  '요청하신 견적서({{quoteNumber}})를 첨부드립니다.\n' +
  '합계: {{total}}원 (부가세 별도)\n\n' +
  '문의 사항이 있으시면 연락 주시기 바랍니다.\n\n' +
  '{{companyName}}';

export type QuotationEmailVars = {
  customerName: string;
  quoteNumber: string;
  total: string;
  companyName: string;
  validUntil: string;
};

export function buildQuotationEmailVars(
  quotation: QuotationRow,
  companyName: string,
): QuotationEmailVars {
  return {
    customerName: quotation.customerName,
    quoteNumber: quotation.quoteNumber,
    total: quotation.total.toLocaleString('ko-KR'),
    companyName,
    validUntil: quotation.validUntil
      ? quotation.validUntil.toISOString().slice(0, 10)
      : '—',
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
    .replace(/\{\{validUntil\}\}/g, vars.validUntil);
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
  const vars = buildQuotationEmailVars(params.quotation, params.companyName);
  const subjectTemplate = resolveTemplate(
    params.subjectOverride,
    params.config?.defaultEmailSubject,
    FALLBACK_SUBJECT,
  );
  const bodyTemplate = resolveTemplate(
    params.bodyOverride,
    params.config?.defaultEmailBody,
    FALLBACK_BODY,
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
