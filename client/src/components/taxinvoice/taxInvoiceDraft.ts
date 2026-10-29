import { bootstrapAuthMeFromLocal } from '../../api/authMeSnapshot';
import { getToken } from '../../stores/auth';
import type { TaxFormLine, TaxKind, TaxParty } from './taxInvoiceFormModel';

export type TaxInvoiceDraft = {
  brandId: string;
  buyer: TaxParty;
  lines: TaxFormLine[];
  taxKind: TaxKind;
  purpose: 1 | 2;
  remark: string;
  cash: string;
  chkBill: string;
  note: string;
  credit: string;
  writeDate: string;
};

function tenantId(): string {
  try {
    const token = getToken();
    const me = token ? bootstrapAuthMeFromLocal(token) : null;
    return me?.tenantId?.trim() || 'tenant';
  } catch {
    return 'tenant';
  }
}

export function taxInvoiceDraftKey(brandId: string): string {
  return `cbiseo-taxinvoice-draft:${tenantId()}:${brandId}`;
}

export function readTaxInvoiceDraft(brandId: string): TaxInvoiceDraft | null {
  if (!brandId) return null;
  try {
    const raw = localStorage.getItem(taxInvoiceDraftKey(brandId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TaxInvoiceDraft;
    if (!parsed || parsed.brandId !== brandId || !parsed.buyer || !Array.isArray(parsed.lines)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeTaxInvoiceDraft(draft: TaxInvoiceDraft): void {
  try {
    localStorage.setItem(taxInvoiceDraftKey(draft.brandId), JSON.stringify(draft));
  } catch {
    /* Safari 개인정보 보호 모드 등 */
  }
}

export function clearTaxInvoiceDraft(brandId: string): void {
  if (!brandId) return;
  try {
    localStorage.removeItem(taxInvoiceDraftKey(brandId));
  } catch {
    /* ignore */
  }
}
