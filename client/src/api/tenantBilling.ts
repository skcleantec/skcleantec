import { API, apiErrorMessage } from './apiPrefix';

export type TenantBillingSummary = {
  billingCycle: 'MONTHLY' | 'ANNUAL';
  trialEndsAt: string | null;
  prepaidConfirmedAt: string | null;
  serviceStartedAt: string | null;
  suspendReason: string | null;
  billingAccessBlockedAt: string | null;
  amountKrw: number;
  amountLabel: string;
  bank: {
    bankName: string | null;
    accountNumber: string | null;
    accountHolder: string | null;
    paymentGuideText: string | null;
  };
  openInvoice: TenantBillingInvoice | null;
  overdueInvoice: TenantBillingInvoice | null;
};

export type TenantBillingInvoice = {
  id: string;
  periodStart: string;
  periodEnd: string;
  billingCycle: 'MONTHLY' | 'ANNUAL';
  plan: string;
  amountKrw: number;
  dueDate: string;
  status: string;
  paidAt: string | null;
  confirmedAt: string | null;
  memo: string | null;
  createdAt: string;
};

export type TenantBillingDunning = {
  showDunning: boolean;
  overdueGraceDays: number;
  daysUntilBlock: number | null;
  accessBlockAt: string | null;
  invoice: TenantBillingInvoice | null;
  bank: {
    bankName: string | null;
    accountNumber: string | null;
    accountHolder: string | null;
    paymentGuideText: string | null;
  };
};

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function fetchTenantBillingDunning(token: string) {
  const res = await fetch(`${API}/admin/tenant-billing/dunning`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '연체 안내 조회 실패'));
  return res.json() as Promise<TenantBillingDunning>;
}

export async function fetchTenantBillingSummary(token: string) {
  const res = await fetch(`${API}/admin/tenant-billing/summary`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '이용료 정보 조회 실패'));
  return res.json() as Promise<TenantBillingSummary>;
}

export async function fetchTenantBillingInvoices(token: string) {
  const res = await fetch(`${API}/admin/tenant-billing/invoices`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '청구서 조회 실패'));
  const data = (await res.json()) as { items: TenantBillingInvoice[] };
  return data.items;
}
