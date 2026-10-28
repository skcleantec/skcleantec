import { API, apiErrorMessage } from './apiPrefix';
import { getToken } from '../stores/auth';

export type TaxInvoiceSearchHit = {
  id: string;
  inquiryNumber: string;
  customerName: string;
  customerPhone: string | null;
  brandId: string;
  brandName: string;
  linked: boolean;
  simplified: boolean;
  certValid: boolean;
  buyer: { corpName: string; email: string; addr: string } | null;
};

export type TaxInvoiceBrand = {
  id: string;
  name: string;
  linked: boolean;
  simplified: boolean;
  certValid: boolean;
  certExpireDate: string | null;
};

export type TaxInvoiceRow = {
  id: string;
  inquiryId: string | null;
  inquiryNumber: string | null;
  customerName: string;
  brandName: string;
  purposeType: number;
  writeDate: string;
  buyerCorpName: string;
  totalAmount: number;
  supplyAmount: number;
  taxAmount: number;
  barobillState: string | null;
  ntsSendState: string | null;
  lastError: string | null;
  canCancel: boolean;
  modifyLater: boolean;
  createdAt: string;
};

function headers(): HeadersInit {
  return { Authorization: `Bearer ${getToken() ?? ''}`, 'Content-Type': 'application/json' };
}

export function taxBarobillStateLabel(state: string | null): string {
  if (state === '1000') return '임시저장';
  if (state === '3014') return '발급완료';
  if (state === '5031') return '발급취소';
  return state ? `상태 ${state}` : '확인 중';
}

export function taxNtsStateLabel(state: string | null): string {
  if (state === '1') return '전송전';
  if (state === '2' || state === '3') return '전송중';
  if (state === '4') return '성공';
  if (state === '5') return '실패';
  return '확인 중';
}

export async function searchTaxInvoiceInquiries(q: string): Promise<TaxInvoiceSearchHit[]> {
  const res = await fetch(`${API}/tax-invoices/inquiry-search?q=${encodeURIComponent(q)}`, { headers: headers() });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '접수를 찾지 못했습니다.'));
  const body = (await res.json()) as { items: TaxInvoiceSearchHit[] };
  return body.items;
}

export async function listTaxInvoices(qs: URLSearchParams): Promise<{ items: TaxInvoiceRow[]; total: number; brands: TaxInvoiceBrand[] }> {
  const res = await fetch(`${API}/tax-invoices?${qs.toString()}`, { headers: headers() });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '세금계산서 목록을 불러오지 못했습니다.'));
  return res.json() as Promise<{ items: TaxInvoiceRow[]; total: number; brands: TaxInvoiceBrand[] }>;
}

export async function issueTaxInvoice(body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${API}/tax-invoices`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '세금계산서 발행에 실패했습니다.'));
}

export async function cancelTaxInvoice(issueId: string): Promise<void> {
  const res = await fetch(`${API}/tax-invoices/${issueId}/cancel`, { method: 'POST', headers: headers(), body: '{}' });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '세금계산서 취소에 실패했습니다.'));
}
