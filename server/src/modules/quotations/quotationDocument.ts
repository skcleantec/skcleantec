/** @see shared/quotationDocument.ts — 클라이언트와 동기화 */
export type QuotationDocumentType = 'QUOTATION' | 'RECEIPT';

export const QUOTATION_DOCUMENT_TYPE_OPTIONS: ReadonlyArray<{
  value: QuotationDocumentType;
  label: string;
}> = [
  { value: 'QUOTATION', label: '견적서' },
  { value: 'RECEIPT', label: '영수증' },
];

export const QUOTATION_DOCUMENT_TYPE_LABELS: Record<QuotationDocumentType, string> = {
  QUOTATION: '견적서',
  RECEIPT: '영수증',
};

export function isQuotationDocumentType(raw: unknown): raw is QuotationDocumentType {
  return raw === 'QUOTATION' || raw === 'RECEIPT';
}

export function formatDocumentTitle(
  brandOrCompanyName: string,
  documentType: QuotationDocumentType = 'QUOTATION',
): string {
  const name = brandOrCompanyName.trim();
  const suffix = QUOTATION_DOCUMENT_TYPE_LABELS[documentType];
  if (!name) return suffix;
  return `${name} ${suffix}`;
}

export function formatQuotationDocumentTitle(brandOrCompanyName: string): string {
  return formatDocumentTitle(brandOrCompanyName, 'QUOTATION');
}

export function getDocumentClosingPhrase(documentType: QuotationDocumentType): string {
  return documentType === 'RECEIPT' ? '위 금액을 영수함.' : '위와 같이 견적합니다.';
}

export function shouldShowQuotationValidUntil(documentType: QuotationDocumentType): boolean {
  return documentType === 'QUOTATION';
}

export type QuotationFooterConfig = {
  footerNotice: string | null;
  receiptFooterNotice: string | null;
};

export function resolveDocumentFooterNotice(
  documentType: QuotationDocumentType,
  config: QuotationFooterConfig,
): string | null {
  if (documentType === 'RECEIPT') {
    const v = config.receiptFooterNotice?.trim();
    return v || null;
  }
  const v = config.footerNotice?.trim();
  return v || null;
}

export function quoteNumberMatchesDocumentType(
  quoteNumber: string,
  documentType: QuotationDocumentType,
): boolean {
  const no = quoteNumber.trim();
  if (documentType === 'RECEIPT') return no.startsWith('R');
  return no.startsWith('Q');
}
