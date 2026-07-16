import type { Prisma, Quotation, QuotationLineItem, QuotationServiceItem } from '@prisma/client';
import { isQuotationDocumentType, type QuotationDocumentType } from './quotationDocument.js';
import {
  computeQuotationVatAmounts,
  parseQuotationVatMode,
  type QuotationVatMode,
} from './quotationVat.js';
import { serializeQuotationOperatingCompany } from './quotationDocumentTitle.service.js';

export type { QuotationVatMode, QuotationDocumentType };
export { computeQuotationVatAmounts, parseQuotationVatMode };

export function parseQuotationDocumentType(raw: unknown): QuotationDocumentType | 'INVALID' {
  if (raw === undefined || raw === null) return 'QUOTATION';
  if (isQuotationDocumentType(raw)) return raw;
  return 'INVALID';
}

export type QuotationLineInput = {
  catalogItemId?: string | null;
  label: string;
  unitPrice: number;
  quantity: number;
  sortOrder?: number;
};

export function computeLineAmount(unitPrice: number, quantity: number): number {
  return unitPrice * quantity;
}

export function computeQuotationTotals(
  lines: { unitPrice: number; quantity: number }[],
  discountAmount = 0,
): { subtotal: number; total: number } {
  const subtotal = lines.reduce((sum, li) => sum + computeLineAmount(li.unitPrice, li.quantity), 0);
  const total = Math.max(0, subtotal - Math.max(0, discountAmount));
  return { subtotal, total };
}

export function parseQuotationLineInputs(raw: unknown): QuotationLineInput[] | 'INVALID' {
  if (!Array.isArray(raw)) return 'INVALID';
  const out: QuotationLineInput[] = [];
  for (let i = 0; i < raw.length; i++) {
    const row = raw[i];
    if (!row || typeof row !== 'object') return 'INVALID';
    const o = row as Record<string, unknown>;
    const label = typeof o.label === 'string' ? o.label.trim() : '';
    if (!label) return 'INVALID';
    const unitPriceRaw = o.unitPrice;
    const quantityRaw = o.quantity;
    const unitPrice =
      typeof unitPriceRaw === 'number'
        ? Math.round(unitPriceRaw)
        : typeof unitPriceRaw === 'string'
          ? Math.round(Number(unitPriceRaw.replace(/,/g, '')))
          : NaN;
    const quantity =
      typeof quantityRaw === 'number'
        ? Math.round(quantityRaw)
        : typeof quantityRaw === 'string'
          ? Math.round(Number(quantityRaw))
          : 1;
    if (!Number.isFinite(unitPrice) || unitPrice < 0) return 'INVALID';
    if (!Number.isFinite(quantity) || quantity < 1) return 'INVALID';
    const catalogItemId =
      typeof o.catalogItemId === 'string' && o.catalogItemId.trim() ? o.catalogItemId.trim() : null;
    const sortOrder =
      typeof o.sortOrder === 'number' && Number.isFinite(o.sortOrder) ? Math.round(o.sortOrder) : i;
    out.push({ catalogItemId, label, unitPrice, quantity, sortOrder });
  }
  return out;
}

export function parseOptionalYmd(raw: unknown): Date | null | 'INVALID' {
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw !== 'string') return 'INVALID';
  const s = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return 'INVALID';
  const [ys, ms, ds] = s.split('-').map(Number);
  const dt = new Date(Date.UTC(ys, ms - 1, ds));
  if (dt.getUTCFullYear() !== ys || dt.getUTCMonth() !== ms - 1 || dt.getUTCDate() !== ds) {
    return 'INVALID';
  }
  return dt;
}

export const quotationInclude = {
  lineItems: { orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] as const },
  createdBy: { select: { id: true, name: true, email: true, role: true } },
  inquiry: { select: { id: true, inquiryNumber: true, customerName: true } },
  operatingCompany: {
    select: { id: true, name: true, slug: true, isDefault: true, config: true },
  },
} satisfies Prisma.QuotationInclude;

export type QuotationRow = Quotation & {
  lineItems: QuotationLineItem[];
  createdBy: { id: string; name: string; email: string; role: string } | null;
  inquiry: { id: string; inquiryNumber: string | null; customerName: string } | null;
  operatingCompany: {
    id: string;
    name: string;
    slug: string;
    isDefault: boolean;
    config: unknown;
  } | null;
};

export function serializeQuotation(row: QuotationRow) {
  const vatMode = row.vatMode as QuotationVatMode;
  const { vatAmount, grandTotal } = computeQuotationVatAmounts(row.total, vatMode);
  const documentType = (row.documentType ?? 'QUOTATION') as QuotationDocumentType;
  return {
    id: row.id,
    quoteNumber: row.quoteNumber,
    documentType,
    status: row.status,
    customerName: row.customerName,
    customerPhone: row.customerPhone,
    customerEmail: row.customerEmail,
    customerAddress: row.customerAddress,
    memo: row.memo,
    subtotal: row.subtotal,
    discountAmount: row.discountAmount,
    total: row.total,
    vatMode,
    vatAmount,
    grandTotal,
    validUntil: row.validUntil ? row.validUntil.toISOString().slice(0, 10) : null,
    inquiryId: row.inquiryId,
    inquiry: row.inquiry,
    operatingCompanyId: row.operatingCompanyId,
    operatingCompany: row.operatingCompany
      ? serializeQuotationOperatingCompany(row.operatingCompany)
      : null,
    createdBy: row.createdBy,
    sentAt: row.sentAt?.toISOString() ?? null,
    lastEmailedAt: row.lastEmailedAt?.toISOString() ?? null,
    pdfSecureUrl: row.pdfSecureUrl,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lineItems: row.lineItems.map((li) => ({
      id: li.id,
      catalogItemId: li.catalogItemId,
      label: li.label,
      unitPrice: li.unitPrice,
      quantity: li.quantity,
      lineAmount: li.lineAmount,
      sortOrder: li.sortOrder,
    })),
  };
}

export function serializeServiceItem(row: QuotationServiceItem) {
  return {
    id: row.id,
    name: row.name,
    unitPrice: row.unitPrice,
    description: row.description,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function serializeQuotationEmailLog(row: {
  id: string;
  to: string;
  subject: string;
  bodyPreview: string | null;
  sentAt: Date;
  success: boolean;
  errorMessage: string | null;
  sentBy: { id: string; name: string } | null;
}) {
  return {
    id: row.id,
    to: row.to,
    subject: row.subject,
    bodyPreview: row.bodyPreview,
    sentAt: row.sentAt.toISOString(),
    success: row.success,
    errorMessage: row.errorMessage,
    sentBy: row.sentBy,
  };
}

export async function verifyActorPassword(
  passwordHash: string,
  password: string,
  compare: (plain: string, hash: string) => Promise<boolean>,
): Promise<boolean> {
  if (!password.trim()) return false;
  return compare(password, passwordHash);
}
