import { API, apiErrorMessage } from './apiPrefix';

export type TenantBillingSummary = {
  billingCycle: 'MONTHLY' | 'ANNUAL';
  pricingMode?: 'CATALOG' | 'CUSTOM';
  customMonthlyAmountKrw?: number | null;
  catalogMonthlyAmountKrw?: number;
  trialEndsAt: string | null;
  prepaidConfirmedAt: string | null;
  serviceStartedAt: string | null;
  billingStartDate?: string | null;
  billingDueDay?: number;
  nextDueDate?: string | null;
  nextDueAmountKrw?: number | null;
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
  currentPeriodStart?: string | null;
  currentPeriodEnd?: string | null;
  currentPeriodStatus?: string | null;
  currentPeriodAmountKrw?: number | null;
  currentPeriodDueDate?: string | null;
  operationalStatus: {
    code: string;
    label: string;
    detail: string | null;
  };
  paymentConfirmationEnabled: boolean;
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

import type {
  TenantBillingDunningPopupContent,
} from '@shared/tenantBilling';

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
  popup: TenantBillingDunningPopupContent;
  paymentConfirmationEnabled: boolean;
};

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function fetchTenantBillingDunning(token: string) {
  const res = await fetch(`${API}/admin/tenant-billing/dunning`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '연체 안내 조회 실패'));
  return res.json() as Promise<TenantBillingDunning>;
}

export async function requestTenantPaymentConfirmation(token: string, invoiceId: string) {
  const res = await fetch(`${API}/admin/tenant-billing/payment-confirmation-request`, {
    method: 'POST',
    headers: { ...authHeaders(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ invoiceId }),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '입금 확인 요청 실패'));
  return res.json() as Promise<{ ok: true; emailSent: boolean; message: string }>;
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

export type TenantBillingScheduleItem = {
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  amountKrw: number;
  status: string;
};

export async function fetchTenantBillingSchedule(token: string) {
  const res = await fetch(`${API}/admin/tenant-billing/schedule`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '납부 일정 조회 실패'));
  return res.json() as Promise<{
    billingStartDate: string | null;
    serviceStartedAt: string | null;
    billingDueDay: number;
    items: TenantBillingScheduleItem[];
  }>;
}
