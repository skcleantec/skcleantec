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
  body: { apiKey: string; tid: string; mid?: string; oid?: string; webhookSecret?: string },
) {
  const res = await fetch(`${API}/platform/card-payment/credentials/${encodeURIComponent(tenantId)}`, {
    method: 'PUT',
    headers: platformHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function fetchPlatformTenantCredential(tenantId: string) {
  const res = await fetch(`${API}/platform/card-payment/credentials/${encodeURIComponent(tenantId)}`, {
    headers: platformHeaders(),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<
    | { connected: false }
    | {
        connected: true;
        isActive: boolean;
        apiKeyLast4: string;
        tidMasked: string;
        mid: string | null;
        oid: string | null;
        connectedAt: string;
      }
  >;
}

export async function probePlatformTenantPayment(tenantId: string) {
  const res = await fetch(`${API}/platform/card-payment/credentials/${encodeURIComponent(tenantId)}/probe`, {
    method: 'POST',
    headers: platformHeaders(),
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
  purpose: 'INVOICE' | 'OTHER';
  tenantName: string | null;
  periodStart: string | null;
  goodsName: string;
  amountKrw: number;
  approvalNo: string | null;
  cardLast4: string;
  buyerName: string;
  memo: string | null;
  invoiceApplied: boolean;
  paidAt: string;
};

export async function fetchUsageFeeCardPayments(limit: number, offset: number) {
  const res = await fetch(
    `${API}/platform/card-payment/usage-fee/payments?limit=${limit}&offset=${offset}`,
    { headers: platformHeaders() },
  );
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{ items: UsageFeeCardPaymentRow[]; total: number }>;
}

export async function payPlatformUsageFeeKeyin(input: {
  purpose: 'INVOICE' | 'OTHER';
  tenantId?: string;
  periodStartYmd?: string;
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
