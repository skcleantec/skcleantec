import type { QuotationServiceItemDto } from '../../api/quotations';

export type EditableQuotationLine = {
  key: string;
  catalogItemId: string | null;
  label: string;
  unitPrice: string;
  quantity: string;
};

export function parsePriceInt(raw: string): number | null {
  const t = raw.replace(/,/g, '').trim();
  if (!t) return null;
  const n = parseInt(t, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function parseQty(raw: string): number | null {
  const t = raw.trim();
  if (!t) return null;
  const n = parseInt(t, 10);
  return Number.isFinite(n) && n >= 1 ? n : null;
}

export function lineAmountFromEditable(li: EditableQuotationLine): number | null {
  const p = parsePriceInt(li.unitPrice);
  const q = parseQty(li.quantity);
  if (p == null || q == null) return null;
  return p * q;
}

export function newLineKey(): string {
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function emptyQuotationLine(catalog?: QuotationServiceItemDto): EditableQuotationLine {
  return {
    key: newLineKey(),
    catalogItemId: catalog?.id ?? null,
    label: catalog?.name ?? '',
    unitPrice: catalog ? String(catalog.unitPrice) : '',
    quantity: '1',
  };
}
