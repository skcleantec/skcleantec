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
    quantity: catalog ? '1' : '',
  };
}

/** 품목표 서식용 빈 행 (수량·단가 미입력) */
export function emptyTemplatePaddingLine(): EditableQuotationLine {
  return {
    key: newLineKey(),
    catalogItemId: null,
    label: '',
    unitPrice: '',
    quantity: '',
  };
}

/** 견적 설정에 등록된 활성 항목으로 초기 행 구성 */
export function linesFromCatalog(catalog: QuotationServiceItemDto[]): EditableQuotationLine[] {
  if (catalog.length === 0) return [emptyQuotationLine()];
  return catalog.map((item) => emptyQuotationLine(item));
}

/** 저장된 catalogItemId 기준으로 품목명·단가를 설정 카탈로그와 동기화 */
export function syncLinesWithCatalog(
  lines: EditableQuotationLine[],
  catalog: QuotationServiceItemDto[],
): EditableQuotationLine[] {
  const byId = new Map(catalog.map((c) => [c.id, c]));
  return lines.map((li) => {
    if (!li.catalogItemId) return li;
    const item = byId.get(li.catalogItemId);
    if (!item) return li;
    return { ...li, label: item.name, unitPrice: String(item.unitPrice) };
  });
}

export function catalogSelectValue(line: EditableQuotationLine): string {
  if (line.catalogItemId) return line.catalogItemId;
  if (line.label.trim()) return '__custom__';
  return '';
}

/** A4 견적서 품목표 최소 행 수 (빈 행 포함 서식) */
export const QUOTATION_TEMPLATE_MIN_ROWS = 8;

export function linesForTemplateDisplay(lines: EditableQuotationLine[]): EditableQuotationLine[] {
  const min = Math.max(QUOTATION_TEMPLATE_MIN_ROWS, lines.length);
  const out = [...lines];
  while (out.length < min) out.push(emptyTemplatePaddingLine());
  return out;
}
