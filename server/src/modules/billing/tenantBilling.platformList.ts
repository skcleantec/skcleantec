import type { TenantBillingCycle, TenantInvoiceStatus, TenantSuspendReason } from '@prisma/client';
import type { BillingProfileDto } from './tenantBilling.profile.service.js';
import type { TenantBillingOperationalStatus } from './tenantBilling.operationalStatus.js';
import type { TenantBillingOperationalStatusCode } from './tenantBilling.operationalStatus.js';

export type PlatformTenantBillingRow = {
  tenantId: string;
  slug: string;
  name: string;
  plan: string;
  status: string;
  billingCycle: TenantBillingCycle;
  pricingMode: BillingProfileDto['pricingMode'];
  contractAmountKrw: number;
  billingDueDay: number;
  serviceStartedAt: string | null;
  nextDueDate: string | null;
  trialEndsAt: string | null;
  prepaidConfirmedAt: string | null;
  suspendReason: TenantSuspendReason | null;
  billingAccessBlockedAt: string | null;
      openInvoiceId: string | null;
  openInvoiceStatus: TenantInvoiceStatus | null;
  openInvoiceDueDate: string | null;
  openInvoiceAmountKrw: number | null;
  /** 업체 ADMIN 「입금확인 요청」 시각 (미납 청구 기준) */
  openInvoicePaymentConfirmationRequestedAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodDueDate: string | null;
  currentPeriodAmountKrw: number | null;
  operationalStatus: TenantBillingOperationalStatus;
};

export const PLATFORM_BILLING_LIST_PAGE_SIZE_OPTIONS = [30, 50, 80, 100] as const;
export type PlatformBillingListPageSize = (typeof PLATFORM_BILLING_LIST_PAGE_SIZE_OPTIONS)[number];
export const PLATFORM_BILLING_LIST_DEFAULT_PAGE_SIZE: PlatformBillingListPageSize = 30;

export type PlatformBillingListQuery = {
  q: string;
  plan: string;
  status: string;
  operationalCode: TenantBillingOperationalStatusCode | '';
  actionQueueOnly: boolean;
  page: number;
  pageSize: PlatformBillingListPageSize;
};

export type PlatformBillingKpi = {
  total: number;
  healthy: number;
  billingIssue: number;
  actionRequired: number;
};

export type PlatformBillingActionKind =
  | 'trial_start'
  | 'confirm_invoice'
  | 'confirm_schedule'
  | 'setup_required';

export type PlatformBillingActionQueueItem = {
  tenantId: string;
  slug: string;
  name: string;
  plan: string;
  operationalCode: TenantBillingOperationalStatusCode;
  operationalLabel: string;
  operationalDetail: string | null;
  actionKind: PlatformBillingActionKind;
  actionLabel: string;
  openInvoiceId: string | null;
  currentPeriodStart: string | null;
  dueDate: string | null;
  amountKrw: number | null;
  paymentConfirmationRequestedAt: string | null;
};

const OPERATIONAL_CODE_SET = new Set<TenantBillingOperationalStatusCode>([
  'TRIAL_PAID',
  'TRIAL_UNPAID',
  'PENDING_START',
  'ACTIVE_OK',
  'ACTIVE_UNPAID_SCHEDULED',
  'ACTIVE_BILLED',
  'ACTIVE_OVERDUE',
  'ACTIVE_BLOCKED',
  'SUSPENDED',
  'SETUP_REQUIRED',
]);

const ACTION_QUEUE_CODES = new Set<TenantBillingOperationalStatusCode>([
  'TRIAL_UNPAID',
  'SETUP_REQUIRED',
  'PENDING_START',
  'ACTIVE_BILLED',
  'ACTIVE_OVERDUE',
  'ACTIVE_UNPAID_SCHEDULED',
]);

const ACTION_PRIORITY: Record<TenantBillingOperationalStatusCode, number> = {
  ACTIVE_OVERDUE: 0,
  ACTIVE_BILLED: 1,
  ACTIVE_UNPAID_SCHEDULED: 2,
  TRIAL_UNPAID: 3,
  PENDING_START: 4,
  SETUP_REQUIRED: 5,
  TRIAL_PAID: 99,
  ACTIVE_OK: 99,
  ACTIVE_BLOCKED: 99,
  SUSPENDED: 99,
};

export function parsePlatformBillingListQuery(raw: Record<string, unknown>): PlatformBillingListQuery {
  const q = typeof raw.q === 'string' ? raw.q.trim() : '';
  const plan = typeof raw.plan === 'string' ? raw.plan.trim().toLowerCase() : '';
  const status = typeof raw.status === 'string' ? raw.status.trim().toUpperCase() : '';
  const operationalRaw = typeof raw.operationalCode === 'string' ? raw.operationalCode.trim() : '';
  const operationalCode = OPERATIONAL_CODE_SET.has(operationalRaw as TenantBillingOperationalStatusCode)
    ? (operationalRaw as TenantBillingOperationalStatusCode)
    : '';
  const actionQueueOnly = raw.actionQueue === '1' || raw.actionQueue === 'true';
  const pageRaw = raw.page ?? raw.p;
  const pageN = typeof pageRaw === 'string' || typeof pageRaw === 'number' ? parseInt(String(pageRaw), 10) : NaN;
  const page = Number.isFinite(pageN) && pageN >= 1 ? Math.floor(pageN) : 1;
  const sizeRaw = raw.pageSize ?? raw.limit;
  const sizeN = typeof sizeRaw === 'string' || typeof sizeRaw === 'number' ? parseInt(String(sizeRaw), 10) : NaN;
  const pageSize = PLATFORM_BILLING_LIST_PAGE_SIZE_OPTIONS.includes(sizeN as PlatformBillingListPageSize)
    ? (sizeN as PlatformBillingListPageSize)
    : PLATFORM_BILLING_LIST_DEFAULT_PAGE_SIZE;
  return { q, plan, status, operationalCode, actionQueueOnly, page, pageSize };
}

export function resolvePlatformBillingAction(row: PlatformTenantBillingRow): {
  actionKind: PlatformBillingActionKind | null;
  actionLabel: string | null;
} {
  const code = row.operationalStatus.code as TenantBillingOperationalStatusCode;
  if (code === 'TRIAL_UNPAID' || code === 'PENDING_START') {
    return { actionKind: 'trial_start', actionLabel: '체험 시작' };
  }
  if (code === 'SETUP_REQUIRED') {
    return { actionKind: 'setup_required', actionLabel: '설정' };
  }
  if (code === 'ACTIVE_BILLED' || code === 'ACTIVE_OVERDUE') {
    if (row.openInvoiceId) {
      return { actionKind: 'confirm_invoice', actionLabel: '입금 확인' };
    }
  }
  if (code === 'ACTIVE_UNPAID_SCHEDULED' && row.currentPeriodStart) {
    return { actionKind: 'confirm_schedule', actionLabel: '입금 확인' };
  }
  return { actionKind: null, actionLabel: null };
}

export function isPlatformBillingActionQueueRow(row: PlatformTenantBillingRow): boolean {
  const code = row.operationalStatus.code as TenantBillingOperationalStatusCode;
  if (!ACTION_QUEUE_CODES.has(code)) return false;
  return resolvePlatformBillingAction(row).actionKind != null;
}

export function buildPlatformBillingKpi(rows: PlatformTenantBillingRow[]): PlatformBillingKpi {
  let healthy = 0;
  let billingIssue = 0;
  let actionRequired = 0;
  for (const row of rows) {
    const code = row.operationalStatus.code as TenantBillingOperationalStatusCode;
    if (code === 'ACTIVE_OK' || code === 'TRIAL_PAID') healthy += 1;
    if (
      code === 'ACTIVE_BILLED' ||
      code === 'ACTIVE_OVERDUE' ||
      code === 'ACTIVE_UNPAID_SCHEDULED' ||
      code === 'ACTIVE_BLOCKED'
    ) {
      billingIssue += 1;
    }
    if (isPlatformBillingActionQueueRow(row)) actionRequired += 1;
  }
  return { total: rows.length, healthy, billingIssue, actionRequired };
}

export function buildPlatformBillingActionQueue(
  rows: PlatformTenantBillingRow[],
  limit = 20,
): PlatformBillingActionQueueItem[] {
  const queue: PlatformBillingActionQueueItem[] = [];
  for (const row of rows) {
    if (!isPlatformBillingActionQueueRow(row)) continue;
    const { actionKind, actionLabel } = resolvePlatformBillingAction(row);
    if (!actionKind || !actionLabel) continue;
    queue.push({
      tenantId: row.tenantId,
      slug: row.slug,
      name: row.name,
      plan: row.plan,
      operationalCode: row.operationalStatus.code as TenantBillingOperationalStatusCode,
      operationalLabel: row.operationalStatus.label,
      operationalDetail: row.operationalStatus.detail,
      actionKind,
      actionLabel,
      openInvoiceId: row.openInvoiceId,
      currentPeriodStart: row.currentPeriodStart,
      dueDate: row.openInvoiceDueDate ?? row.currentPeriodDueDate,
      amountKrw: row.openInvoiceAmountKrw ?? row.currentPeriodAmountKrw,
      paymentConfirmationRequestedAt: row.openInvoicePaymentConfirmationRequestedAt,
    });
  }
  queue.sort((a, b) => {
    const aRequested = a.paymentConfirmationRequestedAt ? 0 : 1;
    const bRequested = b.paymentConfirmationRequestedAt ? 0 : 1;
    if (aRequested !== bRequested) return aRequested - bRequested;
    const pa = ACTION_PRIORITY[a.operationalCode] ?? 50;
    const pb = ACTION_PRIORITY[b.operationalCode] ?? 50;
    if (pa !== pb) return pa - pb;
    const da = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    const db = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    return da - db;
  });
  return queue.slice(0, limit);
}

export function filterPlatformBillingRows(
  rows: PlatformTenantBillingRow[],
  query: PlatformBillingListQuery,
): PlatformTenantBillingRow[] {
  const q = query.q.toLowerCase();
  return rows.filter((row) => {
    if (q && !row.name.toLowerCase().includes(q) && !row.slug.toLowerCase().includes(q)) {
      return false;
    }
    if (query.plan && row.plan !== query.plan) return false;
    if (query.status && row.status !== query.status) return false;
    if (query.operationalCode && row.operationalStatus.code !== query.operationalCode) return false;
    if (query.actionQueueOnly && !isPlatformBillingActionQueueRow(row)) return false;
    return true;
  });
}

export function paginatePlatformBillingRows(
  rows: PlatformTenantBillingRow[],
  page: number,
  pageSize: number,
): { items: PlatformTenantBillingRow[]; total: number; limit: number; offset: number; page: number } {
  const total = rows.length;
  const totalPageCount = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPageCount);
  const offset = (safePage - 1) * pageSize;
  return {
    items: rows.slice(offset, offset + pageSize),
    total,
    limit: pageSize,
    offset,
    page: safePage,
  };
}
