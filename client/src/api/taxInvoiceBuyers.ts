import { API, apiErrorMessage } from './apiPrefix';
import { getToken } from '../stores/auth';

function headers(): HeadersInit {
  return { Authorization: `Bearer ${getToken() ?? ''}`, 'Content-Type': 'application/json' };
}

export type TaxInvoiceBuyerRow = {
  id: string;
  bizNumber: string;
  corpName: string;
  ceoName: string;
  addr: string;
  bizType: string;
  bizClass: string;
  email: string;
  email2: string;
  contactName: string;
  tel: string;
  memo: string;
  lastUsedAt: string;
  useCount: number;
};

export type TaxInvoiceBuyerInput = {
  bizNumber: string;
  corpName: string;
  ceoName?: string;
  addr?: string;
  bizType?: string;
  bizClass?: string;
  email?: string;
  email2?: string;
  contactName?: string;
  tel?: string;
  memo?: string;
};

export type TaxInvoiceBuyerPatch = Partial<Omit<TaxInvoiceBuyerInput, 'bizNumber'>>;

export type TaxInvoiceBuyerApi = {
  list: (q: string) => Promise<TaxInvoiceBuyerRow[]>;
  upsert: (body: TaxInvoiceBuyerInput) => Promise<TaxInvoiceBuyerRow>;
  update: (id: string, body: TaxInvoiceBuyerPatch) => Promise<TaxInvoiceBuyerRow>;
  remove: (id: string) => Promise<void>;
};

export async function listTaxInvoiceBuyers(q = ''): Promise<TaxInvoiceBuyerRow[]> {
  const qs = new URLSearchParams({ limit: '30' });
  if (q) qs.set('q', q);
  const res = await fetch(`${API}/tax-invoices/buyers?${qs}`, { headers: headers() });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '거래처 목록을 불러오지 못했습니다.'));
  const body = (await res.json()) as { items: TaxInvoiceBuyerRow[] };
  return body.items;
}

export async function upsertTaxInvoiceBuyer(input: TaxInvoiceBuyerInput): Promise<TaxInvoiceBuyerRow> {
  const res = await fetch(`${API}/tax-invoices/buyers`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '거래처를 저장하지 못했습니다.'));
  return res.json() as Promise<TaxInvoiceBuyerRow>;
}

export async function updateTaxInvoiceBuyer(id: string, patch: TaxInvoiceBuyerPatch): Promise<TaxInvoiceBuyerRow> {
  const res = await fetch(`${API}/tax-invoices/buyers/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '거래처를 수정하지 못했습니다.'));
  return res.json() as Promise<TaxInvoiceBuyerRow>;
}

export async function removeTaxInvoiceBuyer(id: string): Promise<void> {
  const res = await fetch(`${API}/tax-invoices/buyers/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: headers(),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '거래처를 삭제하지 못했습니다.'));
}

/** 테넌트용 TaxInvoiceBuyerApi 인스턴스 */
export const tenantTaxInvoiceBuyerApi: TaxInvoiceBuyerApi = {
  list: listTaxInvoiceBuyers,
  upsert: upsertTaxInvoiceBuyer,
  update: updateTaxInvoiceBuyer,
  remove: removeTaxInvoiceBuyer,
};
