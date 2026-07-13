import { API, apiErrorMessage } from './apiPrefix';
import type {
  BillingScheduleItemStatus,
  TenantBillingAdjustmentType,
  TenantBillingCycle,
  TenantBillingPricingMode,
} from '@shared/tenantBilling';

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
  billingCycle: TenantBillingCycle;
  pricingMode: TenantBillingPricingMode;
  contractAmountKrw: number;
  billingDueDay: number;
  serviceStartedAt: string | null;
  nextDueDate: string | null;
  trialEndsAt: string | null;
  prepaidConfirmedAt: string | null;
  suspendReason: string | null;
  billingAccessBlockedAt: string | null;
  openInvoiceStatus: string | null;
  openInvoiceDueDate: string | null;
};

export type TenantInvoiceRow = {
  id: string;
  periodStart: string;
  periodEnd: string;
  billingCycle: TenantBillingCycle;
  plan: string;
  amountKrw: number;
  dueDate: string;
  status: 'DRAFT' | 'ISSUED' | 'PAID' | 'OVERDUE' | 'VOID';
  source: 'AUTO' | 'MANUAL';
  paidAt: string | null;
  confirmedAt: string | null;
  memo: string | null;
  createdAt: string;
};

export type BillingProfileRow = {
  billingCycle: TenantBillingCycle;
  pricingMode: TenantBillingPricingMode;
  customMonthlyAmountKrw: number | null;
  customAnnualAmountKrw: number | null;
  billingDueDay: number;
  billingStartDate: string | null;
  autoIssueEnabled: boolean;
  contractMemo: string | null;
};

export type BillingAdjustmentRow = {
  id: string;
  type: TenantBillingAdjustmentType;
  targetPeriodStart: string;
  customAmountKrw: number | null;
  reason: string;
  voidedAt: string | null;
  createdAt: string;
};

export type BillingScheduleRow = {
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  amountKrw: number;
  catalogAmountKrw: number;
  status: BillingScheduleItemStatus;
  invoiceId: string | null;
  adjustment: {
    id: string;
    type: TenantBillingAdjustmentType;
    reason: string;
    deferMode?: 'SHIFT' | 'MERGE';
  } | null;
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
  profile: BillingProfileRow;
  summary: {
    billingCycle: TenantBillingCycle;
    pricingMode: TenantBillingPricingMode;
    customMonthlyAmountKrw: number | null;
    catalogMonthlyAmountKrw: number;
    billingStartDate: string | null;
    billingDueDay: number;
    nextDueDate: string | null;
    nextDueAmountKrw: number | null;
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
  schedule: BillingScheduleRow[];
  adjustments: BillingAdjustmentRow[];
};

export type PatchBillingProfileBody = {
  billingCycle?: TenantBillingCycle;
  pricingMode?: TenantBillingPricingMode;
  customMonthlyAmountKrw?: number | null;
  customAnnualAmountKrw?: number | null;
  billingDueDay?: number;
  billingStartDate?: string | null;
  autoIssueEnabled?: boolean;
  contractMemo?: string | null;
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
  body: PatchBillingProfileBody,
) {
  const res = await fetch(`${API}/platform/billing/tenants/${tenantId}/profile`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '계약 조건 저장 실패'));
  return res.json() as Promise<BillingProfileRow>;
}

export async function createPlatformBillingAdjustment(
  token: string,
  tenantId: string,
  body: {
    type: TenantBillingAdjustmentType;
    targetPeriodStart: string;
    customAmountKrw?: number | null;
    reason: string;
  },
) {
  const res = await fetch(`${API}/platform/billing/tenants/${tenantId}/adjustments`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '예외 등록 실패'));
  return res.json() as Promise<{ adjustment: BillingAdjustmentRow }>;
}

export async function voidPlatformBillingAdjustment(
  token: string,
  tenantId: string,
  adjustmentId: string,
) {
  const res = await fetch(`${API}/platform/billing/tenants/${tenantId}/adjustments/${adjustmentId}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '예외 취소 실패'));
  return res.json() as Promise<{ ok: boolean }>;
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
