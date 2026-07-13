import { API, apiErrorMessage } from './apiPrefix';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export type PlatformBillingSettings = {
  bankName: string | null;
  accountNumber: string | null;
  accountHolder: string | null;
  paymentGuideText: string | null;
  overdueGraceDays: number;
  updatedAt: string;
};

export type PlatformBillingTenantRow = {
  tenantId: string;
  slug: string;
  name: string;
  plan: string;
  status: string;
  billingCycle: 'MONTHLY' | 'ANNUAL';
  trialEndsAt: string | null;
  prepaidConfirmedAt: string | null;
  serviceStartedAt: string | null;
  suspendReason: string | null;
  billingAccessBlockedAt: string | null;
  openInvoiceStatus: string | null;
  openInvoiceDueDate: string | null;
};

export type TenantInvoiceRow = {
  id: string;
  periodStart: string;
  periodEnd: string;
  billingCycle: 'MONTHLY' | 'ANNUAL';
  plan: string;
  amountKrw: number;
  dueDate: string;
  status: 'DRAFT' | 'ISSUED' | 'PAID' | 'OVERDUE' | 'VOID';
  paidAt: string | null;
  confirmedAt: string | null;
  memo: string | null;
  createdAt: string;
};

export type PlatformTenantBillingDetail = {
  tenant: {
    id: string;
    slug: string;
    name: string;
    plan: string;
    status: string;
    trialEndsAt: string | null;
    prepaidConfirmedAt: string | null;
    serviceStartedAt: string | null;
    suspendReason: string | null;
    billingAccessBlockedAt: string | null;
    createdAt: string;
  };
  profile: { billingCycle: 'MONTHLY' | 'ANNUAL' };
  summary: {
    billingCycle: 'MONTHLY' | 'ANNUAL';
    amountKrw: number;
    amountLabel: string;
    bank: {
      bankName: string | null;
      accountNumber: string | null;
      accountHolder: string | null;
      paymentGuideText: string | null;
    };
    openInvoice: TenantInvoiceRow | null;
    overdueInvoice: TenantInvoiceRow | null;
  };
  invoices: TenantInvoiceRow[];
};

export async function getPlatformBillingSettings(token: string) {
  const res = await fetch(`${API}/platform/billing/settings`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '설정 조회 실패'));
  return res.json() as Promise<PlatformBillingSettings>;
}

export async function patchPlatformBillingSettings(
  token: string,
  body: Partial<Omit<PlatformBillingSettings, 'updatedAt'>>,
) {
  const res = await fetch(`${API}/platform/billing/settings`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '설정 저장 실패'));
  return res.json() as Promise<PlatformBillingSettings>;
}

export async function listPlatformBillingTenants(token: string) {
  const res = await fetch(`${API}/platform/billing/tenants`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '목록 조회 실패'));
  const data = (await res.json()) as { items: PlatformBillingTenantRow[] };
  return data.items;
}

export async function getPlatformTenantBilling(token: string, tenantId: string) {
  const res = await fetch(`${API}/platform/billing/tenants/${tenantId}`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '결제 정보 조회 실패'));
  return res.json() as Promise<PlatformTenantBillingDetail>;
}

export async function patchPlatformTenantBillingProfile(
  token: string,
  tenantId: string,
  billingCycle: 'MONTHLY' | 'ANNUAL',
) {
  const res = await fetch(`${API}/platform/billing/tenants/${tenantId}/profile`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ billingCycle }),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '납부 주기 저장 실패'));
  return res.json() as Promise<{ billingCycle: 'MONTHLY' | 'ANNUAL' }>;
}

export async function confirmPlatformPrepaid(token: string, tenantId: string) {
  const res = await fetch(`${API}/platform/billing/tenants/${tenantId}/prepaid-confirm`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '선납 확인 실패'));
  return res.json() as Promise<{ prepaidConfirmedAt: string; serviceStartsAt: string; message: string }>;
}

export async function issuePlatformTenantInvoice(token: string, tenantId: string) {
  const res = await fetch(`${API}/platform/billing/tenants/${tenantId}/invoices`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ asDraft: false }),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '청구서 발행 실패'));
  return res.json() as Promise<{ invoice: TenantInvoiceRow }>;
}

export async function confirmPlatformInvoicePayment(token: string, invoiceId: string) {
  const res = await fetch(`${API}/platform/billing/invoices/${invoiceId}/confirm-payment`, {
    method: 'POST',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '납부 확인 실패'));
  return res.json() as Promise<{ invoice: TenantInvoiceRow }>;
}
