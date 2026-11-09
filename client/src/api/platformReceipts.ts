import { API } from './apiPrefix';
import { getPlatformToken } from '../stores/platformAuth';

function platformHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${getPlatformToken() ?? ''}`,
    'Content-Type': 'application/json',
  };
}

async function parseError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error || fallback;
  } catch {
    return fallback;
  }
}

export type PlatformReceiptListFilter = {
  from?: string;
  to?: string;
  status?: string;
  q?: string;
  limit?: number;
  offset?: number;
};

function filterQuery(filter: PlatformReceiptListFilter): URLSearchParams {
  const q = new URLSearchParams();
  if (filter.from) q.set('from', filter.from.replace(/\D/g, ''));
  if (filter.to) q.set('to', filter.to.replace(/\D/g, ''));
  if (filter.status) q.set('status', filter.status);
  if (filter.q) q.set('q', filter.q);
  q.set('limit', String(filter.limit ?? 30));
  q.set('offset', String(filter.offset ?? 0));
  return q;
}

// ── 발급자(Issuer) ─────────────────────────────────────────────────────────

export type PlatformReceiptIssuer = {
  corpNum: string;
  corpNumDisplay?: string;
  corpNumMasked: string;
  corpName: string;
  ceoName: string | null;
  addr: string | null;
  bizType: string | null;
  bizClass: string | null;
};

export type PlatformReceiptCert = {
  valid: boolean;
  expireDate: string | null;
};

export async function fetchPlatformReceiptIssuer(): Promise<PlatformReceiptIssuer> {
  const res = await fetch(`${API}/platform/receipts/issuer`, { headers: platformHeaders() });
  if (!res.ok) throw new Error(await parseError(res, '발급자 정보를 불러오지 못했습니다.'));
  return res.json() as Promise<PlatformReceiptIssuer>;
}

export async function fetchPlatformReceiptCert(): Promise<PlatformReceiptCert> {
  const res = await fetch(`${API}/platform/receipts/issuer/cert`, { headers: platformHeaders() });
  if (!res.ok) throw new Error(await parseError(res, '인증서 상태를 불러오지 못했습니다.'));
  return res.json() as Promise<PlatformReceiptCert>;
}

export async function openPlatformReceiptCertUrl(): Promise<{ url: string }> {
  const res = await fetch(`${API}/platform/receipts/issuer/cert-url`, {
    method: 'POST',
    headers: platformHeaders(),
  });
  if (!res.ok) throw new Error(await parseError(res, '공동인증서 등록 창을 열지 못했습니다.'));
  return res.json() as Promise<{ url: string }>;
}

// ── 현금영수증(Cashbill) ───────────────────────────────────────────────────

export type PlatformCashbillRow = {
  id: string;
  status: 'ISSUED' | 'CANCELLED' | 'FAILED';
  taxKind: 'taxable' | 'exempt';
  usage: 'phone' | 'biz' | 'voluntary';
  usageLabel?: string;
  identity: string | null;
  itemName: string;
  amountKrw: number;
  supplyAmountKrw: number;
  vatAmountKrw: number;
  tradeDate: string;
  issuedAt: string;
  cancelledAt: string | null;
  buyerName: string | null;
  buyerCorpNum: string | null;
  email: string | null;
  memo: string | null;
  error: string | null;
  tenantName: string | null;
  ntsConfirmNum?: string | null;
};

export type PlatformReceiptMonthStats = {
  count: number;
  costKrw: number;
  totalAmountKrw: number;
  supplyAmountKrw: number;
  vatAmountKrw: number;
};

export async function listPlatformCashbills(
  filter: PlatformReceiptListFilter,
): Promise<{ items: PlatformCashbillRow[]; total: number }> {
  const res = await fetch(`${API}/platform/receipts/cashbills?${filterQuery(filter)}`, {
    headers: platformHeaders(),
  });
  if (!res.ok) throw new Error(await parseError(res, '현금영수증 목록을 불러오지 못했습니다.'));
  return res.json() as Promise<{ items: PlatformCashbillRow[]; total: number }>;
}

export type IssuePlatformCashbillBody = {
  tenantId?: string;
  identity?: string;
  usage: 'phone' | 'biz' | 'voluntary';
  taxKind: 'taxable' | 'exempt';
  amountKrw: number;
  itemName: string;
  tradeDate: string;
  email?: string;
  buyerName?: string;
  memo?: string;
};

export async function issuePlatformCashbill(body: IssuePlatformCashbillBody): Promise<PlatformCashbillRow> {
  const res = await fetch(`${API}/platform/receipts/cashbills`, {
    method: 'POST',
    headers: platformHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res, '현금영수증 발행에 실패했습니다.'));
  return res.json() as Promise<PlatformCashbillRow>;
}

export async function cancelPlatformCashbill(id: string): Promise<{ ok: true }> {
  const res = await fetch(`${API}/platform/receipts/cashbills/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
    headers: platformHeaders(),
  });
  if (!res.ok) throw new Error(await parseError(res, '현금영수증 취소에 실패했습니다.'));
  return res.json() as Promise<{ ok: true }>;
}

export async function fetchPlatformCashbillMonthStats(
  filter: Pick<PlatformReceiptListFilter, 'from' | 'to' | 'status' | 'q'> = {},
): Promise<PlatformReceiptMonthStats> {
  const q = filterQuery({ ...filter, limit: 1, offset: 0 });
  q.delete('limit');
  q.delete('offset');
  const res = await fetch(`${API}/platform/receipts/cashbills/month-stats?${q}`, {
    headers: platformHeaders(),
  });
  if (!res.ok) throw new Error(await parseError(res, '통계를 불러오지 못했습니다.'));
  return res.json() as Promise<PlatformReceiptMonthStats>;
}

export async function downloadPlatformCashbillExcel(
  filter: Pick<PlatformReceiptListFilter, 'from' | 'to' | 'status' | 'q'>,
): Promise<void> {
  const q = filterQuery({ ...filter, limit: 1, offset: 0 });
  q.delete('limit');
  q.delete('offset');
  const res = await fetch(`${API}/platform/receipts/cashbills/export?${q}`, {
    headers: { Authorization: `Bearer ${getPlatformToken() ?? ''}` },
  });
  if (!res.ok) throw new Error(await parseError(res, '엑셀을 받지 못했습니다.'));
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `플랫폼_현금영수증.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── 세금계산서(Tax Invoice) ────────────────────────────────────────────────

export type PlatformTaxInvoiceRow = {
  id: string;
  status: 'ISSUED' | 'CANCELLED' | 'FAILED';
  writeDate: string;
  issuedAt: string;
  cancelledAt: string | null;
  buyerCorpNum: string;
  buyerCorpName: string;
  buyerCeoName: string | null;
  buyerAddr: string | null;
  buyerEmail: string | null;
  supplyAmountKrw: number;
  vatAmountKrw: number;
  totalAmountKrw: number;
  itemName: string;
  memo: string | null;
  error: string | null;
  tenantName: string | null;
  usageLabel?: string;
  ntsConfirmNum?: string | null;
};

export async function listPlatformTaxInvoices(
  filter: PlatformReceiptListFilter,
): Promise<{ items: PlatformTaxInvoiceRow[]; total: number }> {
  const res = await fetch(`${API}/platform/receipts/tax-invoices?${filterQuery(filter)}`, {
    headers: platformHeaders(),
  });
  if (!res.ok) throw new Error(await parseError(res, '세금계산서 목록을 불러오지 못했습니다.'));
  return res.json() as Promise<{ items: PlatformTaxInvoiceRow[]; total: number }>;
}

export type IssuePlatformTaxInvoiceBody = {
  tenantId?: string;
  writeDate: string;
  corpNum: string;
  corpName: string;
  ceoName?: string;
  addr?: string;
  email?: string;
  bizType?: string;
  bizClass?: string;
  supplyAmountKrw: number;
  vatAmountKrw: number;
  itemName: string;
  memo?: string;
};

export async function issuePlatformTaxInvoice(body: IssuePlatformTaxInvoiceBody): Promise<PlatformTaxInvoiceRow> {
  const res = await fetch(`${API}/platform/receipts/tax-invoices`, {
    method: 'POST',
    headers: platformHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res, '세금계산서 발행에 실패했습니다.'));
  return res.json() as Promise<PlatformTaxInvoiceRow>;
}

export async function cancelPlatformTaxInvoice(id: string): Promise<{ ok: true }> {
  const res = await fetch(`${API}/platform/receipts/tax-invoices/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
    headers: platformHeaders(),
  });
  if (!res.ok) throw new Error(await parseError(res, '세금계산서 취소에 실패했습니다.'));
  return res.json() as Promise<{ ok: true }>;
}

export async function fetchPlatformTaxInvoiceMonthStats(
  filter: Pick<PlatformReceiptListFilter, 'from' | 'to' | 'status' | 'q'> = {},
): Promise<PlatformReceiptMonthStats> {
  const q = filterQuery({ ...filter, limit: 1, offset: 0 });
  q.delete('limit');
  q.delete('offset');
  const res = await fetch(`${API}/platform/receipts/tax-invoices/month-stats?${q}`, {
    headers: platformHeaders(),
  });
  if (!res.ok) throw new Error(await parseError(res, '통계를 불러오지 못했습니다.'));
  return res.json() as Promise<PlatformReceiptMonthStats>;
}

export async function downloadPlatformTaxInvoiceExcel(
  filter: Pick<PlatformReceiptListFilter, 'from' | 'to' | 'status' | 'q'>,
): Promise<void> {
  const q = filterQuery({ ...filter, limit: 1, offset: 0 });
  q.delete('limit');
  q.delete('offset');
  const res = await fetch(`${API}/platform/receipts/tax-invoices/export?${q}`, {
    headers: { Authorization: `Bearer ${getPlatformToken() ?? ''}` },
  });
  if (!res.ok) throw new Error(await parseError(res, '엑셀을 받지 못했습니다.'));
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `플랫폼_세금계산서.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── 매수인 업체 목록 ───────────────────────────────────────────────────────

export type PlatformBuyerTenant = {
  id: string;
  name: string;
  slug: string;
  corpNum: string | null;
  corpName: string | null;
  ceoName: string | null;
  addr: string | null;
  bizType: string | null;
  bizClass: string | null;
  email: string | null;
};

export async function fetchPlatformTenantsForBuyer(): Promise<{ items: PlatformBuyerTenant[] }> {
  const res = await fetch(`${API}/platform/receipts/tenants-for-buyer`, { headers: platformHeaders() });
  if (!res.ok) throw new Error(await parseError(res, '업체 목록을 불러오지 못했습니다.'));
  return res.json() as Promise<{ items: PlatformBuyerTenant[] }>;
}

// ── 지갑 세금계산서 재발행 ─────────────────────────────────────────────────

export async function retryPlatformWalletInvoice(paymentId: string): Promise<{ ok: true }> {
  const res = await fetch(`${API}/platform/receipts/wallet-invoices/${encodeURIComponent(paymentId)}/retry`, {
    method: 'POST',
    headers: platformHeaders(),
  });
  if (!res.ok) throw new Error(await parseError(res, '세금계산서 재발행에 실패했습니다.'));
  return res.json() as Promise<{ ok: true }>;
}
