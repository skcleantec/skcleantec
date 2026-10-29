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

export type TaxInvoiceSupplier = {
  corpNum: string;
  corpName: string;
  ceoName: string;
  addr: string;
  bizType: string;
  bizClass: string;
  email: string;
  tel: string;
  contactName?: string;
};

export type TaxInvoiceBrand = {
  id: string;
  name: string;
  linked: boolean;
  simplified: boolean;
  certValid: boolean;
  certExpireDate: string | null;
  /** GetCorpState.TaxType. 4면 면세사업자. */
  memberTaxType?: string | null;
  supplier?: TaxInvoiceSupplier | null;
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
  buyerCorpNum?: string;
  totalAmount: number;
  supplyAmount: number;
  taxAmount: number;
  barobillState: string | null;
  ntsSendState: string | null;
  lastError: string | null;
  ntsSendKey?: string | null;
  itemName?: string;
  canCancel: boolean;
  modifyLater: boolean;
  copyReady?: boolean;
  publicToken?: string | null;
  createdAt: string;
  taxKind?: 'taxable' | 'zero' | 'exempt';
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

export async function searchTaxInvoiceInquiries(q: string, inquiryId?: string): Promise<TaxInvoiceSearchHit[]> {
  const qs = new URLSearchParams();
  if (q) qs.set('q', q);
  if (inquiryId) qs.set('inquiryId', inquiryId);
  const res = await fetch(`${API}/tax-invoices/inquiry-search?${qs.toString()}`, { headers: headers() });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '접수를 찾지 못했습니다.'));
  const body = (await res.json()) as { items: TaxInvoiceSearchHit[] };
  return body.items;
}

export async function listTaxInvoices(qs: URLSearchParams): Promise<{
  items: TaxInvoiceRow[];
  total: number;
  brands: TaxInvoiceBrand[];
  summary?: { issuedCount: number; issuedWon: number; waitingCount: number; failedCount: number; costWon: number };
}> {
  const res = await fetch(`${API}/tax-invoices?${qs.toString()}`, { headers: headers() });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '세금계산서 목록을 불러오지 못했습니다.'));
  return res.json() as Promise<{
    items: TaxInvoiceRow[];
    total: number;
    brands: TaxInvoiceBrand[];
    summary?: { issuedCount: number; issuedWon: number; waitingCount: number; failedCount: number; costWon: number };
  }>;
}

export async function updateTaxInvoiceSupplier(
  operatingCompanyId: string,
  body: {
    corpName: string;
    ceoName: string;
    addr1: string;
    bizType: string;
    bizClass: string;
    contactEmail: string;
    contactTel: string;
    contactName: string;
  },
): Promise<TaxInvoiceSupplier> {
  const res = await fetch(`${API}/tax-invoices/supplier`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({ operatingCompanyId, ...body }),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '공급자 정보를 저장하지 못했습니다.'));
  return res.json() as Promise<TaxInvoiceSupplier>;
}

export async function issueTaxInvoice(body: Record<string, unknown>): Promise<{ id: string }> {
  const res = await fetch(`${API}/tax-invoices`, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '세금계산서 발행에 실패했습니다.'));
  return res.json() as Promise<{ id: string }>;
}

export type TaxInvoiceReissueSource = {
  operatingCompanyId: string;
  purposeType: 1 | 2;
  taxKind: 'taxable' | 'zero' | 'exempt';
  remark: string;
  buyerTaxRegId: string;
  buyer: {
    corpNum: string;
    corpName: string;
    ceoName: string;
    addr: string;
    email: string;
    bizType: string;
    bizClass: string;
  };
  lines: Array<{
    name: string;
    month: string;
    day: string;
    spec: string;
    qty: string;
    unitPrice: string;
    supply: string | number;
    tax: string | number;
    remark: string;
  }>;
};

export async function fetchTaxInvoiceSource(issueId: string): Promise<TaxInvoiceReissueSource> {
  const res = await fetch(`${API}/tax-invoices/${issueId}/source`, { headers: headers() });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '다시 발행할 내용을 불러오지 못했습니다.'));
  return res.json() as Promise<TaxInvoiceReissueSource>;
}

export async function cancelTaxInvoice(issueId: string): Promise<void> {
  const res = await fetch(`${API}/tax-invoices/${issueId}/cancel`, { method: 'POST', headers: headers(), body: '{}' });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '세금계산서 취소에 실패했습니다.'));
}
