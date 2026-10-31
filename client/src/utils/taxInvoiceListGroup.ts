import type { TaxInvoiceRow } from '../api/taxInvoices';

export type TaxListConnect = 'none' | 'start' | 'mid' | 'end';

export type TaxListSlot = {
  row: TaxInvoiceRow;
  nested: boolean;
  connect: TaxListConnect;
};

/** 수정 건은 정렬과 상관없이, 같은 목록에 원래 건이 있으면 그 바로 아래에 붙인다. */
export function groupTaxInvoiceRows(items: TaxInvoiceRow[]): TaxListSlot[] {
  const ids = new Set(items.map((row) => row.id));
  const children = new Map<string, TaxInvoiceRow[]>();
  const nested = new Set<string>();
  for (const row of items) {
    const parentId = row.originalIssueId;
    if (!parentId || parentId === row.id || !ids.has(parentId)) continue;
    const list = children.get(parentId) ?? [];
    list.push(row);
    children.set(parentId, list);
    nested.add(row.id);
  }
  for (const list of children.values()) {
    list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  const slots: TaxListSlot[] = [];
  for (const row of items) {
    if (nested.has(row.id)) continue;
    const kids = children.get(row.id) ?? [];
    slots.push({ row, nested: false, connect: kids.length > 0 ? 'start' : 'none' });
    kids.forEach((kid, index) => {
      slots.push({
        row: kid,
        nested: true,
        connect: index === kids.length - 1 ? 'end' : 'mid',
      });
    });
  }
  return slots;
}

export function approvalTail(key: string | null | undefined): string {
  const text = (key ?? '').replace(/\s/g, '');
  if (!text) return '';
  return text.slice(-4);
}
