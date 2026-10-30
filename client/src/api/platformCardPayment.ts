import { API } from './apiPrefix';
import { getPlatformToken } from '../stores/platformAuth';
import type { PgOnboardingRow } from './cardPayment';

function platformHeaders() {
  const token = getPlatformToken();
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function parseError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string };
    return j.error || `요청 실패 (${res.status})`;
  } catch {
    return `요청 실패 (${res.status})`;
  }
}

export async function fetchPlatformCardPaymentSettings() {
  const res = await fetch(`${API}/platform/card-payment/settings`, { headers: platformHeaders() });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{
    tenantFeeBps: number;
    platformCostBps: number;
    summary: {
      approvedCount: number;
      amountWon: number;
      tenantFeeWon: number;
      platformCostWon: number;
      platformSpreadWon: number;
    };
    serviceBridge?: {
      purpose: 'USAGE_FEE';
      keyin: { configured: false } | { configured: true; mid: string; tidMasked: string; oid: string; apiKeyLast4: string };
      appCard: { configured: false } | { configured: true; mid: string; tidMasked: string; oid: string; apiKeyLast4: string };
    };
  }>;
}

export async function savePlatformCardPaymentSettings(body: { tenantFeeBps: number; platformCostBps: number }) {
  const res = await fetch(`${API}/platform/card-payment/settings`, {
    method: 'PUT',
    headers: platformHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function fetchPlatformPgOnboardings(query: { status?: string; limit: number; offset: number }) {
  const q = new URLSearchParams();
  if (query.status) q.set('status', query.status);
  q.set('limit', String(query.limit));
  q.set('offset', String(query.offset));
  const res = await fetch(`${API}/platform/card-payment/onboardings?${q}`, { headers: platformHeaders() });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{
    total: number;
    items: Array<PgOnboardingRow & { tenant: { id: string; name: string; slug: string } }>;
  }>;
}

export async function patchPlatformPgOnboarding(
  tenantId: string,
  body: { status: string; platformMemo?: string },
) {
  const res = await fetch(`${API}/platform/card-payment/onboardings/${encodeURIComponent(tenantId)}`, {
    method: 'PATCH',
    headers: platformHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function savePlatformPgCredential(
  tenantId: string,
  body: { rail: 'KEYIN' | 'LINK'; apiKey: string; tid?: string; mid?: string; oid?: string; webhookSecret?: string },
) {
  const res = await fetch(`${API}/platform/card-payment/credentials/${encodeURIComponent(tenantId)}`, {
    method: 'PUT',
    headers: platformHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export type PlatformCredentialSlot =
  | { connected: false }
  | {
      connected: true;
      rail: 'KEYIN' | 'LINK';
      isActive: boolean;
      apiKeyLast4: string;
      tidMasked: string;
      mid: string | null;
      oid: string | null;
      connectedAt: string;
    };

export async function fetchPlatformTenantCredential(tenantId: string) {
  const res = await fetch(`${API}/platform/card-payment/credentials/${encodeURIComponent(tenantId)}`, {
    headers: platformHeaders(),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{ keyin: PlatformCredentialSlot; link: PlatformCredentialSlot }>;
}

export async function probePlatformTenantPayment(tenantId: string, rail: 'KEYIN' | 'LINK') {
  const res = await fetch(`${API}/platform/card-payment/credentials/${encodeURIComponent(tenantId)}/probe`, {
    method: 'POST',
    headers: platformHeaders(),
    body: JSON.stringify({ rail }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<
    | { rail: 'KEYIN'; ok: boolean; message: string }
    | { rail: 'PAY_WINDOW'; ok: boolean; message: string; redirectUrl?: string }
  >;
}

export async function openPlatformUsageFeeWindow() {
  const res = await fetch(`${API}/platform/card-payment/usage-fee/window`, {
    method: 'POST',
    headers: platformHeaders(),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{ ok: boolean; message: string; redirectUrl?: string }>;
}

export type UsageFeeOpenPeriod = {
  periodStartYmd: string;
  periodLabel: string;
  amountKrw: number;
  supplyAmountKrw?: number;
  vatAmountKrw?: number;
  chargeAmountKrw?: number;
  status: string;
};

export async function fetchUsageFeeOpenPeriods(tenantId: string) {
  const res = await fetch(
    `${API}/platform/card-payment/usage-fee/open-periods?tenantId=${encodeURIComponent(tenantId)}`,
    { headers: platformHeaders() },
  );
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{ items: UsageFeeOpenPeriod[] }>;
}

export type UsageFeeCardPaymentRow = {
  id: string;
  purpose: 'INVOICE' | 'OTHER' | 'CLEANING_PROXY';
  purposeLabel?: string;
  payMethod: 'BANK' | 'KEYIN' | 'PAY_WINDOW';
  methodLabel?: string;
  status: 'PENDING' | 'APPROVED' | 'FAILED' | 'CANCELLED';
  statusLabel?: string;
  cancelable: boolean;
  tenantName: string | null;
  inquiryLabel?: string | null;
  periodStart: string | null;
  goodsName: string;
  supplyAmountKrw: number;
  vatAmountKrw: number;
  amountKrw: number;
  approvalNo: string | null;
  cardLast4: string | null;
  buyerName: string | null;
  buyerPhone?: string | null;
  memo: string | null;
  linkUrl?: string | null;
  linkExpiresAt?: string | null;
  invoiceApplied: boolean;
  paidAt: string;
  needsReconcile?: boolean;
  cancelBlockReason?: string | null;
};

export async function fetchUsageFeeCardPayments(
  limit: number,
  offset: number,
  payMethod?: string,
  filters?: { purpose?: string; channel?: string },
) {
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (payMethod) query.set('payMethod', payMethod);
  if (filters?.purpose) query.set('purpose', filters.purpose);
  if (filters?.channel) query.set('channel', filters.channel);
  const res = await fetch(`${API}/platform/card-payment/usage-fee/payments?${query.toString()}`, {
    headers: platformHeaders(),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{ items: UsageFeeCardPaymentRow[]; total: number }>;
}

export async function cancelUsageFeeCardPayment(id: string) {
  const res = await fetch(`${API}/platform/card-payment/usage-fee/payments/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
    headers: platformHeaders(),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{ ok: true; needsReconcile?: boolean; message?: string }>;
}

export type PlatformPayInquiryHit = { id: string; label: string; inquiryNumber: string | null };

export async function searchPlatformPayInquiries(tenantId: string, q: string) {
  const query = new URLSearchParams({ tenantId, q });
  const res = await fetch(`${API}/platform/card-payment/usage-fee/inquiries?${query.toString()}`, {
    headers: platformHeaders(),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return (await res.json()).items as PlatformPayInquiryHit[];
}

export async function fetchPlatformSellerCenterStatus() {
  const res = await fetch(`${API}/platform/card-payment/usage-fee/seller-center`, { headers: platformHeaders() });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{ saved: boolean; loginIdPrefix: string }>;
}

export async function revealPlatformSellerCenter() {
  const res = await fetch(`${API}/platform/card-payment/usage-fee/seller-center/reveal`, {
    method: 'POST',
    headers: platformHeaders(),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{ loginId: string; password: string }>;
}

export async function createPlatformPayLink(input: {
  purpose: 'INVOICE' | 'OTHER' | 'CLEANING_PROXY';
  tenantId?: string;
  periodStartYmd?: string;
  inquiryId?: string;
  goodsName: string;
  amountWon: number;
  buyerName: string;
  buyerPhone?: string;
  memo?: string;
}) {
  const res = await fetch(`${API}/platform/card-payment/usage-fee/links`, {
    method: 'POST',
    headers: { ...platformHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{
    id: string;
    url: string;
    amountKrw: number;
    buyerName: string | null;
    tenantName: string | null;
    expiresAt: string;
    goodsName: string;
  }>;
}

export async function closePlatformPayLink(id: string) {
  const res = await fetch(`${API}/platform/card-payment/usage-fee/links/${encodeURIComponent(id)}/close`, {
    method: 'POST',
    headers: platformHeaders(),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{ ok: true }>;
}

export async function payPlatformUsageFeeKeyin(input: {
  purpose: 'INVOICE' | 'OTHER' | 'CLEANING_PROXY';
  tenantId?: string;
  periodStartYmd?: string;
  inquiryId?: string;
  memo?: string;
  goodsName: string;
  amountWon: number;
  cardNo: string;
  expireYY: string;
  expireMM: string;
  installment: string;
  certPw: string;
  certNo: string;
  buyerName: string;
  buyerPhone: string;
}) {
  const res = await fetch(`${API}/platform/card-payment/usage-fee/keyin`, {
    method: 'POST',
    headers: { ...platformHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{
    ok: boolean;
    message: string;
    approvalNo?: string;
    orderNo?: string;
    amountWon?: number;
    cardLast4?: string;
    invoiceApplied?: boolean;
  }>;
}

export async function probePlatformUsageFeeKeyin() {
  const res = await fetch(`${API}/platform/card-payment/usage-fee/keyin-probe`, {
    method: 'POST',
    headers: platformHeaders(),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{ ok: boolean; message: string }>;
}
