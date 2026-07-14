import type {
  TenantBillingAdjustmentType,
  TenantBillingCycle,
  TenantBillingPricingMode,
  TenantInvoiceStatus,
} from '@prisma/client';
import type { TenantPlanId } from '../tenants/tenantFeatureCatalog.js';
import {
  calculateAnnualFromMonthlyKrw,
  calculateBillingAmountKrw,
  TENANT_BILLING_ANNUAL_DISCOUNT_RATE,
} from './tenantBilling.constants.js';
import {
  addMonthsClamped,
  addYearsClamped,
  billingPeriodForStart,
  dueDateForPeriodStart,
  kstStartOfDayUtc,
  kstYmdFromDate,
  nextPeriodStartAfter,
} from './tenantBilling.dates.js';

export type BillingProfileInput = {
  billingCycle: TenantBillingCycle;
  pricingMode: TenantBillingPricingMode;
  customMonthlyAmountKrw: number | null;
  customAnnualAmountKrw: number | null;
  billingDueDay: number;
};

export type BillingAdjustmentInput = {
  id: string;
  type: TenantBillingAdjustmentType;
  targetPeriodStart: Date;
  customAmountKrw: number | null;
  reason: string;
};

export type BillingInvoiceInput = {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  amountKrw: number;
  dueDate: Date;
  status: TenantInvoiceStatus;
};

export type BillingScheduleItem = {
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  amountKrw: number;
  catalogAmountKrw: number;
  status:
    | TenantInvoiceStatus
    | 'SCHEDULED'
    | 'SKIPPED'
    | 'DEFERRED';
  invoiceId: string | null;
  adjustment: {
    id: string;
    type: TenantBillingAdjustmentType;
    reason: string;
    deferMode?: 'SHIFT' | 'MERGE';
  } | null;
};

export function periodStartKey(d: Date): string {
  return kstYmdFromDate(d);
}

function catalogMonthlyKrw(plan: string): number {
  return calculateBillingAmountKrw(plan, 'MONTHLY');
}

export function resolvePeriodBaseAmountKrw(
  profile: BillingProfileInput,
  plan: string,
  cycle: TenantBillingCycle,
): number {
  const catalogMonthly = catalogMonthlyKrw(plan);
  if (profile.pricingMode === 'CUSTOM') {
    const monthly = profile.customMonthlyAmountKrw ?? catalogMonthly;
    if (cycle === 'ANNUAL') {
      return profile.customAnnualAmountKrw ?? calculateAnnualFromMonthlyKrw(monthly);
    }
    return monthly;
  }
  return calculateBillingAmountKrw(plan, cycle);
}

function advanceCursorAfterShift(
  periodEnd: Date,
  cycle: TenantBillingCycle,
): Date {
  const normalNext = nextPeriodStartAfter(periodEnd);
  if (cycle === 'ANNUAL') {
    return addYearsClamped(normalNext, 1);
  }
  return addMonthsClamped(normalNext, 1);
}

export function computeBillingSchedule(input: {
  plan: string;
  profile: BillingProfileInput;
  billingStart: Date;
  invoices: BillingInvoiceInput[];
  adjustments: BillingAdjustmentInput[];
  now?: Date;
  maxItems?: number;
  futureScheduledMin?: number;
}): BillingScheduleItem[] {
  const {
    plan,
    profile,
    billingStart,
    invoices,
    adjustments,
    now = new Date(),
    maxItems = 120,
    futureScheduledMin = 1,
  } = input;

  const cycle = profile.billingCycle;
  const invoicesByStart = new Map<string, BillingInvoiceInput>();
  for (const inv of invoices) {
    if (inv.status === 'VOID') continue;
    invoicesByStart.set(periodStartKey(inv.periodStart), inv);
  }
  const adjustmentsByStart = new Map<string, BillingAdjustmentInput>();
  for (const adj of adjustments) {
    adjustmentsByStart.set(periodStartKey(adj.targetPeriodStart), adj);
  }

  const items: BillingScheduleItem[] = [];
  let cursor = billingStart;
  let mergePending = 0;
  let safety = 0;
  const todayStart = kstStartOfDayUtc(kstYmdFromDate(now));

  while (items.length < maxItems && safety++ < 120) {
    const { periodStart, periodEnd } = billingPeriodForStart(cursor, cycle);
    const key = periodStartKey(periodStart);
    const adj = adjustmentsByStart.get(key);
    const baseAmount = resolvePeriodBaseAmountKrw(profile, plan, cycle);
    const catalogAmount = calculateBillingAmountKrw(plan, cycle);
    const dueDate = dueDateForPeriodStart(periodStart, profile.billingDueDay);

    if (adj?.type === 'SKIP') {
      items.push({
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        dueDate: dueDate.toISOString(),
        amountKrw: 0,
        catalogAmountKrw: catalogAmount,
        status: 'SKIPPED',
        invoiceId: null,
        adjustment: { id: adj.id, type: adj.type, reason: adj.reason },
      });
      cursor = nextPeriodStartAfter(periodEnd);
      mergePending = 0;
      continue;
    }

    if (adj?.type === 'DEFER_SHIFT') {
      items.push({
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        dueDate: dueDate.toISOString(),
        amountKrw: baseAmount,
        catalogAmountKrw: catalogAmount,
        status: 'DEFERRED',
        invoiceId: null,
        adjustment: { id: adj.id, type: adj.type, reason: adj.reason, deferMode: 'SHIFT' },
      });
      cursor = advanceCursorAfterShift(periodEnd, cycle);
      mergePending = 0;
      continue;
    }

    if (adj?.type === 'DEFER_MERGE') {
      mergePending += baseAmount;
      items.push({
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        dueDate: dueDate.toISOString(),
        amountKrw: baseAmount,
        catalogAmountKrw: catalogAmount,
        status: 'DEFERRED',
        invoiceId: null,
        adjustment: { id: adj.id, type: adj.type, reason: adj.reason, deferMode: 'MERGE' },
      });
      cursor = nextPeriodStartAfter(periodEnd);
      continue;
    }

    const customOverride = adj?.type === 'CUSTOM_AMOUNT' ? adj.customAmountKrw : null;
    const amountKrw =
      customOverride != null
        ? customOverride + mergePending
        : baseAmount + mergePending;
    mergePending = 0;

    const existingInv = invoicesByStart.get(key);
    let status: BillingScheduleItem['status'];
    if (existingInv) {
      status = existingInv.status;
    } else if (periodStart.getTime() > todayStart.getTime()) {
      status = 'SCHEDULED';
    } else {
      status = 'SCHEDULED';
    }

    items.push({
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      dueDate: (existingInv?.dueDate ?? dueDate).toISOString(),
      amountKrw: existingInv?.amountKrw ?? amountKrw,
      catalogAmountKrw: catalogAmount,
      status,
      invoiceId: existingInv?.id ?? null,
      adjustment:
        adj?.type === 'CUSTOM_AMOUNT'
          ? { id: adj.id, type: adj.type, reason: adj.reason }
          : null,
    });

    cursor = nextPeriodStartAfter(periodEnd);

    const futureScheduled = items.filter(
      (i) => i.status === 'SCHEDULED' && new Date(i.periodStart).getTime() > todayStart.getTime(),
    ).length;
    const lastPeriodStart = new Date(items[items.length - 1]!.periodStart);
    if (futureScheduled >= futureScheduledMin && lastPeriodStart.getTime() > todayStart.getTime()) {
      break;
    }
  }

  return items;
}

export function findAutoIssueScheduleItems(
  schedule: BillingScheduleItem[],
  now = new Date(),
): BillingScheduleItem[] {
  const todayStart = kstStartOfDayUtc(kstYmdFromDate(now));
  return schedule.filter((item) => {
    if (item.invoiceId) return false;
    if (item.status === 'SKIPPED' || item.status === 'DEFERRED') return false;
    if (item.amountKrw <= 0) return false;
    return new Date(item.periodStart).getTime() <= todayStart.getTime();
  });
}

export function pickNextDueScheduleItem(
  schedule: BillingScheduleItem[],
  now = new Date(),
): BillingScheduleItem | null {
  const todayStart = kstStartOfDayUtc(kstYmdFromDate(now));
  const candidates = schedule.filter(
    (i) =>
      i.amountKrw > 0 &&
      i.status !== 'SKIPPED' &&
      i.status !== 'DEFERRED' &&
      i.status !== 'PAID' &&
      i.status !== 'VOID' &&
      new Date(i.dueDate).getTime() >= todayStart.getTime(),
  );
  candidates.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  return candidates[0] ?? null;
}

export { TENANT_BILLING_ANNUAL_DISCOUNT_RATE };
