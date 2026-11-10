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
  kind?: string;
  limit?: number;
  offset?: number;
};

function filterQuery(filter: PlatformReceiptListFilter): URLSearchParams {
  const q = new URLSearchParams();
  if (filter.from) q.set('from', filter.from.replace(/\D/g, ''));
  if (filter.to) q.set('to', filter.to.replace(/\D/g, ''));
  if (filter.status) q.set('status', filter.status);
  if (filter.q) q.set('q', filter.q);
  if (filter.kind) q.set('kind', filter.kind);
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

export async function retryPlatformWalletInvoicesBatch(
  paymentIds: string[],
): Promise<{ ok: number; failed: number }> {
  const res = await fetch(`${API}/platform/receipts/wallet-invoices/retry-batch`, {
    method: 'POST',
    headers: platformHeaders(),
    body: JSON.stringify({ paymentIds }),
  });
  if (!res.ok) throw new Error(await parseError(res, '일괄 발행에 실패했습니다.'));
  return res.json() as Promise<{ ok: number; failed: number }>;
}

export type PlatformWalletInvoiceQueueRow = {
  id: string;
  paymentId: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  paidAt: string;
  supplyAmountKrw: number;
  vatAmountKrw: number;
  totalAmountKrw: number;
  status: 'PENDING' | 'FAILED';
  error: string | null;
  missingBizInfo: boolean;
};

export async function fetchWalletInvoiceQueue(limit = 50, offset = 0) {
  const q = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  const res = await fetch(`${API}/platform/receipts/wallet-invoices/queue?${q}`, {
    headers: platformHeaders(),
  });
  if (!res.ok) throw new Error(await parseError(res, '발행할 목록을 불러오지 못했습니다.'));
  return res.json() as Promise<{ items: PlatformWalletInvoiceQueueRow[]; total: number }>;
}

export async function fetchWalletInvoiceQueueCount(): Promise<number> {
  const res = await fetch(`${API}/platform/receipts/wallet-invoices/queue-count`, {
    headers: platformHeaders(),
  });
  if (!res.ok) throw new Error(await parseError(res, '건수를 불러오지 못했습니다.'));
  const body = (await res.json()) as { count: number };
  return body.count ?? 0;
}

export type PlatformIssuedReceiptRow = {
  id: string;
  source: 'cashbill' | 'taxinvoice' | 'wallet_taxinvoice';
  kind: 'cashbill' | 'taxinvoice';
  purpose: 'wallet' | 'direct';
  purposeLabel: string;
  kindLabel: string;
  issuedAt: string;
  partyName: string;
  tenantId: string | null;
  supplyAmountKrw: number;
  vatAmountKrw: number;
  totalAmountKrw: number;
  status: 'ISSUED' | 'CANCELLED' | 'FAILED';
  ntsConfirmNum: string | null;
  paymentId: string | null;
  error: string | null;
  canCancel: boolean;
  canView: boolean;
};

export async function listPlatformIssuedReceipts(filter: PlatformReceiptListFilter) {
  const res = await fetch(`${API}/platform/receipts/issued?${filterQuery(filter)}`, {
    headers: platformHeaders(),
  });
  if (!res.ok) throw new Error(await parseError(res, '발행 목록을 불러오지 못했습니다.'));
  return res.json() as Promise<{
    items: PlatformIssuedReceiptRow[];
    total: number;
    stats: PlatformReceiptMonthStats;
  }>;
}

export async function downloadPlatformIssuedExcel(
  filter: Pick<PlatformReceiptListFilter, 'from' | 'to' | 'status' | 'q' | 'kind'>,
): Promise<void> {
  const q = filterQuery({ ...filter, limit: 1, offset: 0 });
  q.delete('limit');
  q.delete('offset');
  const res = await fetch(`${API}/platform/receipts/issued/export?${q}`, {
    headers: { Authorization: `Bearer ${getPlatformToken() ?? ''}` },
  });
  if (!res.ok) throw new Error(await parseError(res, '엑셀을 받지 못했습니다.'));
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `플랫폼_발행목록.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function cancelPlatformWalletInvoice(paymentId: string): Promise<{ ok: true }> {
  const res = await fetch(
    `${API}/platform/receipts/wallet-invoices/${encodeURIComponent(paymentId)}/cancel`,
    { method: 'POST', headers: platformHeaders() },
  );
  if (!res.ok) throw new Error(await parseError(res, '취소에 실패했습니다.'));
  return res.json() as Promise<{ ok: true }>;
}

// ── 플랫폼 거래처(Buyer) CRUD ──────────────────────────────────────────────

export type PlatformTaxInvoiceBuyerRow = {
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

export type PlatformTaxInvoiceBuyerInput = {
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

export type PlatformTaxInvoiceBuyerPatch = Partial<Omit<PlatformTaxInvoiceBuyerInput, 'bizNumber'>>;

export async function listPlatformTaxInvoiceBuyers(q = ''): Promise<PlatformTaxInvoiceBuyerRow[]> {
  const qs = new URLSearchParams({ limit: '30' });
  if (q) qs.set('q', q);
  const res = await fetch(`${API}/platform/receipts/buyers?${qs}`, { headers: platformHeaders() });
  if (!res.ok) throw new Error(await parseError(res, '거래처 목록을 불러오지 못했습니다.'));
  const body = (await res.json()) as { items: PlatformTaxInvoiceBuyerRow[] };
  return body.items;
}

export async function upsertPlatformTaxInvoiceBuyer(
  input: PlatformTaxInvoiceBuyerInput,
): Promise<PlatformTaxInvoiceBuyerRow> {
  const res = await fetch(`${API}/platform/receipts/buyers`, {
    method: 'POST',
    headers: platformHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseError(res, '거래처를 저장하지 못했습니다.'));
  return res.json() as Promise<PlatformTaxInvoiceBuyerRow>;
}

export async function updatePlatformTaxInvoiceBuyer(
  id: string,
  patch: PlatformTaxInvoiceBuyerPatch,
): Promise<PlatformTaxInvoiceBuyerRow> {
  const res = await fetch(`${API}/platform/receipts/buyers/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: platformHeaders(),
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(await parseError(res, '거래처를 수정하지 못했습니다.'));
  return res.json() as Promise<PlatformTaxInvoiceBuyerRow>;
}

export async function removePlatformTaxInvoiceBuyer(id: string): Promise<void> {
  const res = await fetch(`${API}/platform/receipts/buyers/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: platformHeaders(),
  });
  if (!res.ok) throw new Error(await parseError(res, '거래처를 삭제하지 못했습니다.'));
}

// ── 개별 세금계산서/현금영수증 메일·인쇄 URL ──────────────────────────────

export async function fetchPlatformReceiptMailUrl(
  kind: 'taxinvoice' | 'cashbill',
  id: string,
  mode: 'mail' | 'print' = 'mail',
): Promise<string> {
  const path = kind === 'taxinvoice' ? 'tax-invoices' : 'cashbills';
  const q = new URLSearchParams({ kind: mode });
  const res = await fetch(`${API}/platform/receipts/${path}/${encodeURIComponent(id)}/mail-url?${q}`, {
    headers: platformHeaders(),
  });
  if (!res.ok) throw new Error(await parseError(res, '영수증 주소를 받지 못했습니다.'));
  const body = (await res.json()) as { url?: string };
  if (!body.url) throw new Error('영수증 주소를 받지 못했습니다.');
  return body.url;
}

export async function fetchPlatformReceiptViewUrl(input: {
  source: 'cashbill' | 'taxinvoice' | 'wallet_taxinvoice';
  id?: string;
  paymentId?: string;
  tenantId?: string | null;
}): Promise<string> {
  const q = new URLSearchParams({ source: input.source });
  if (input.id) q.set('id', input.id);
  if (input.paymentId) q.set('paymentId', input.paymentId);
  if (input.tenantId) q.set('tenantId', input.tenantId);
  const res = await fetch(`${API}/platform/receipts/view-url?${q}`, { headers: platformHeaders() });
  if (!res.ok) throw new Error(await parseError(res, '영수증을 열 수 없습니다.'));
  const body = (await res.json()) as { url?: string };
  if (!body.url) throw new Error('영수증을 열 수 없습니다.');
  return body.url;
}
