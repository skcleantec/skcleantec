import { API, apiErrorMessage } from './apiPrefix';
import { getToken } from '../stores/auth';
import { getPlatformToken } from '../stores/platformAuth';

export type CashbillIssueDefaults = {
  taxKind: 'taxable' | 'exempt';
  usage: 'phone' | 'biz' | 'voluntary';
  itemName: string;
  amountBasis: 'balance' | 'total';
  memo: string;
};

export type TaxInvoiceIssueDefaults = {
  taxKind: 'taxable' | 'zero' | 'exempt';
  purposeType: 1 | 2;
  itemName: string;
  writeDateBasis: 'today' | 'preferredDate';
  buyerEmail: string;
  remark: string;
};

export type ReceiptIssueSettingsResponse<T> = {
  kind: 'CASHBILL' | 'TAXINVOICE';
  operatingCompanyId: string | null;
  values: T;
  brands: { id: string; name: string }[];
  canEdit: boolean;
};

function tenantHeaders(): HeadersInit {
  return { Authorization: `Bearer ${getToken() ?? ''}`, 'Content-Type': 'application/json' };
}

function platformHeaders(): HeadersInit {
  return { Authorization: `Bearer ${getPlatformToken() ?? ''}`, 'Content-Type': 'application/json' };
}

export async function fetchCashbillIssueSettings(brandId?: string | null): Promise<ReceiptIssueSettingsResponse<CashbillIssueDefaults>> {
  const qs = new URLSearchParams();
  if (brandId) qs.set('brandId', brandId);
  const res = await fetch(`${API}/cashbill/issue-settings?${qs}`, { headers: tenantHeaders() });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '발행 기본설정을 불러오지 못했습니다.'));
  return res.json() as Promise<ReceiptIssueSettingsResponse<CashbillIssueDefaults>>;
}

export async function saveCashbillIssueSettings(
  brandId: string | null,
  values: CashbillIssueDefaults,
): Promise<ReceiptIssueSettingsResponse<CashbillIssueDefaults>> {
  const res = await fetch(`${API}/cashbill/issue-settings`, {
    method: 'PUT',
    headers: tenantHeaders(),
    body: JSON.stringify({ brandId, values }),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '발행 기본설정을 저장하지 못했습니다.'));
  return res.json() as Promise<ReceiptIssueSettingsResponse<CashbillIssueDefaults>>;
}

export async function fetchTaxInvoiceIssueSettings(brandId?: string | null): Promise<ReceiptIssueSettingsResponse<TaxInvoiceIssueDefaults>> {
  const qs = new URLSearchParams();
  if (brandId) qs.set('brandId', brandId);
  const res = await fetch(`${API}/tax-invoices/issue-settings?${qs}`, { headers: tenantHeaders() });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '발행 기본설정을 불러오지 못했습니다.'));
  return res.json() as Promise<ReceiptIssueSettingsResponse<TaxInvoiceIssueDefaults>>;
}

export async function saveTaxInvoiceIssueSettings(
  brandId: string | null,
  values: TaxInvoiceIssueDefaults,
): Promise<ReceiptIssueSettingsResponse<TaxInvoiceIssueDefaults>> {
  const res = await fetch(`${API}/tax-invoices/issue-settings`, {
    method: 'PUT',
    headers: tenantHeaders(),
    body: JSON.stringify({ brandId, values }),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '발행 기본설정을 저장하지 못했습니다.'));
  return res.json() as Promise<ReceiptIssueSettingsResponse<TaxInvoiceIssueDefaults>>;
}

export async function fetchPlatformIssueSettings(
  kind: 'CASHBILL' | 'TAXINVOICE',
): Promise<ReceiptIssueSettingsResponse<CashbillIssueDefaults | TaxInvoiceIssueDefaults>> {
  const res = await fetch(`${API}/platform/receipts/issue-settings?kind=${kind}`, { headers: platformHeaders() });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '발행 기본설정을 불러오지 못했습니다.'));
  return res.json() as Promise<ReceiptIssueSettingsResponse<CashbillIssueDefaults | TaxInvoiceIssueDefaults>>;
}

export async function savePlatformIssueSettings(
  kind: 'CASHBILL' | 'TAXINVOICE',
  values: CashbillIssueDefaults | TaxInvoiceIssueDefaults,
): Promise<ReceiptIssueSettingsResponse<CashbillIssueDefaults | TaxInvoiceIssueDefaults>> {
  const res = await fetch(`${API}/platform/receipts/issue-settings`, {
    method: 'PUT',
    headers: platformHeaders(),
    body: JSON.stringify({ kind, values }),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '발행 기본설정을 저장하지 못했습니다.'));
  return res.json() as Promise<ReceiptIssueSettingsResponse<CashbillIssueDefaults | TaxInvoiceIssueDefaults>>;
}

export const CASHBILL_DEFAULT_FALLBACK: CashbillIssueDefaults = {
  taxKind: 'taxable',
  usage: 'phone',
  itemName: '청소 서비스',
  amountBasis: 'balance',
  memo: '',
};

export const TAXINVOICE_DEFAULT_FALLBACK: TaxInvoiceIssueDefaults = {
  taxKind: 'taxable',
  purposeType: 1,
  itemName: '',
  writeDateBasis: 'today',
  buyerEmail: '',
  remark: '',
};

export function cashbillTaxKindLabel(v: CashbillIssueDefaults['taxKind']): string {
  return v === 'exempt' ? '면세' : '과세';
}

export function taxInvoiceTaxKindLabel(v: TaxInvoiceIssueDefaults['taxKind']): string {
  if (v === 'exempt') return '면세';
  if (v === 'zero') return '영세';
  return '과세';
}

export function cashbillUsageLabel(v: CashbillIssueDefaults['usage']): string {
  if (v === 'biz') return '지출증빙';
  if (v === 'voluntary') return '자진발급';
  return '소득공제';
}
