import type { Prisma, TenantBillingCycle, TenantInvoiceSource, TenantInvoiceStatus, TenantSuspendReason } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import {
  calculateBillingAmountKrw,
  TENANT_BILLING_DEFAULT_GRACE_DAYS,
  TENANT_PREPAID_SERVICE_DELAY_DAYS,
  TENANT_TRIAL_DAYS,
} from './tenantBilling.constants.js';
import {
  addDaysUtc,
  billingPeriodForStart,
  dueDateForPeriodStart,
  kstDayOfMonthFromDate,
  kstStartOfDayUtc,
  kstYmdFromDate,
} from './tenantBilling.dates.js';
import {
  ensureTenantBillingProfile,
  getTenantBillingCycle,
  listTenantBillingAdjustments,
  mapBillingProfile,
  resolveBillingStartDate,
  updateTenantBillingProfile,
  updateTenantBillingProfileContract,
  type BillingAdjustmentDto,
  type BillingProfileDto,
} from './tenantBilling.profile.service.js';
import {
  computeBillingSchedule,
  findAutoIssueScheduleItems,
  pickNextDueScheduleItem,
  periodStartKey,
  resolvePeriodBaseAmountKrw,
  type BillingScheduleItem,
} from './tenantBilling.schedule.js';
import { TenantNotFoundError } from '../tenants/tenant.service.js';
import {
  resolveTenantBillingOperationalStatus,
  type TenantBillingOperationalStatus,
} from './tenantBilling.operationalStatus.js';

export type BillingSettingsDto = {
  bankName: string | null;
  accountNumber: string | null;
  accountHolder: string | null;
  paymentGuideText: string | null;
  overdueGraceDays: number;
  updatedAt: string;
};

export type InvoiceDto = {
  id: string;
  periodStart: string;
  periodEnd: string;
  billingCycle: TenantBillingCycle;
  plan: string;
  amountKrw: number;
  dueDate: string;
  status: TenantInvoiceStatus;
  source: TenantInvoiceSource;
  paidAt: string | null;
  confirmedAt: string | null;
  memo: string | null;
  createdAt: string;
};

export type TenantBillingSummaryDto = {
  billingCycle: TenantBillingCycle;
  pricingMode: BillingProfileDto['pricingMode'];
  customMonthlyAmountKrw: number | null;
  catalogMonthlyAmountKrw: number;
  trialEndsAt: string | null;
  prepaidConfirmedAt: string | null;
  serviceStartedAt: string | null;
  billingStartDate: string | null;
  billingDueDay: number;
  nextDueDate: string | null;
  nextDueAmountKrw: number | null;
  suspendReason: TenantSuspendReason | null;
  billingAccessBlockedAt: string | null;
  amountKrw: number;
  amountLabel: string;
  bank: {
    bankName: string | null;
    accountNumber: string | null;
    accountHolder: string | null;
    paymentGuideText: string | null;
  };
  openInvoice: InvoiceDto | null;
  overdueInvoice: InvoiceDto | null;
  operationalStatus: TenantBillingOperationalStatus;
};

function mapInvoice(row: {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  billingCycle: TenantBillingCycle;
  plan: string;
  amountKrw: number;
  dueDate: Date;
  status: TenantInvoiceStatus;
  source: TenantInvoiceSource;
  paidAt: Date | null;
  confirmedAt: Date | null;
  memo: string | null;
  createdAt: Date;
}): InvoiceDto {
  return {
    id: row.id,
    periodStart: row.periodStart.toISOString(),
    periodEnd: row.periodEnd.toISOString(),
    billingCycle: row.billingCycle,
    plan: row.plan,
    amountKrw: row.amountKrw,
    dueDate: row.dueDate.toISOString(),
    status: row.status,
    source: row.source,
    paidAt: row.paidAt?.toISOString() ?? null,
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    memo: row.memo,
    createdAt: row.createdAt.toISOString(),
  };
}

export {
  ensureTenantBillingProfile,
  getTenantBillingCycle,
  updateTenantBillingProfile,
  updateTenantBillingProfileContract,
  listTenantBillingAdjustments,
  createTenantBillingAdjustment,
  voidTenantBillingAdjustment,
  mapBillingProfile,
  type BillingProfileDto,
  type BillingAdjustmentDto,
} from './tenantBilling.profile.service.js';

export async function loadTenantBillingScheduleContext(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, plan: true, serviceStartedAt: true },
  });
  if (!tenant) throw new TenantNotFoundError();

  const [profileRow, invoices, adjustments] = await Promise.all([
    ensureTenantBillingProfile(tenantId),
    prisma.tenantInvoice.findMany({
      where: { tenantId },
      orderBy: { periodStart: 'asc' },
    }),
    prisma.tenantBillingAdjustment.findMany({
      where: { tenantId, voidedAt: null },
    }),
  ]);

  const profile = mapBillingProfile(profileRow);
  const billingStart =
    profile.billingStartDate != null
      ? new Date(profile.billingStartDate)
      : tenant.serviceStartedAt;

  const schedule =
    billingStart != null
      ? computeBillingSchedule({
          plan: tenant.plan,
          profile,
          billingStart,
          invoices: invoices.map((i) => ({
            id: i.id,
            periodStart: i.periodStart,
            periodEnd: i.periodEnd,
            amountKrw: i.amountKrw,
            dueDate: i.dueDate,
            status: i.status,
          })),
          adjustments: adjustments.map((a) => ({
            id: a.id,
            type: a.type,
            targetPeriodStart: a.targetPeriodStart,
            customAmountKrw: a.customAmountKrw,
            reason: a.reason,
          })),
        })
      : [];

  return { tenant, profile, billingStart, schedule, invoices, adjustments };
}

export async function getTenantBillingSchedule(tenantId: string): Promise<{
  billingStartDate: string | null;
  serviceStartedAt: string | null;
  profile: BillingProfileDto;
  items: BillingScheduleItem[];
  adjustments: BillingAdjustmentDto[];
}> {
  const ctx = await loadTenantBillingScheduleContext(tenantId);
  const adjustments = await listTenantBillingAdjustments(tenantId);
  return {
    billingStartDate: ctx.billingStart?.toISOString() ?? null,
    serviceStartedAt: ctx.tenant.serviceStartedAt?.toISOString() ?? null,
    profile: ctx.profile,
    items: ctx.schedule,
    adjustments,
  };
}

async function createInvoiceFromScheduleItem(
  tenantId: string,
  plan: string,
  profile: BillingProfileDto,
  item: BillingScheduleItem,
  source: TenantInvoiceSource,
): Promise<InvoiceDto> {
  const catalogAmountKrw = calculateBillingAmountKrw(plan, profile.billingCycle);
  const row = await prisma.tenantInvoice.create({
    data: {
      tenantId,
      periodStart: new Date(item.periodStart),
      periodEnd: new Date(item.periodEnd),
      billingCycle: profile.billingCycle,
      plan,
      amountKrw: item.amountKrw,
      catalogAmountKrw,
      dueDate: new Date(item.dueDate),
      status: 'ISSUED',
      source,
      adjustmentId: item.adjustment?.id ?? null,
    },
  });
  return mapInvoice(row);
}

export async function issueInvoiceForTenant(
  tenantId: string,
  asDraft = false,
  source: TenantInvoiceSource = 'MANUAL',
): Promise<InvoiceDto> {
  const ctx = await loadTenantBillingScheduleContext(tenantId);
  if (!ctx.billingStart) {
    throw new Error('과금 시작일이 없어 청구서를 발행할 수 없습니다.');
  }

  const pending = findAutoIssueScheduleItems(ctx.schedule).filter((i) => !i.invoiceId);
  const target = pending[0];
  if (!target) {
    throw new Error('발행할 청구 기간이 없습니다.');
  }

  const existing = await prisma.tenantInvoice.findFirst({
    where: {
      tenantId,
      periodStart: new Date(target.periodStart),
      status: { not: 'VOID' },
    },
  });
  if (existing) {
    throw new Error('해당 기간 청구서가 이미 있습니다.');
  }

  if (asDraft) {
    const catalogAmountKrw = calculateBillingAmountKrw(ctx.tenant.plan, ctx.profile.billingCycle);
    const row = await prisma.tenantInvoice.create({
      data: {
        tenantId,
        periodStart: new Date(target.periodStart),
        periodEnd: new Date(target.periodEnd),
        billingCycle: ctx.profile.billingCycle,
        plan: ctx.tenant.plan,
        amountKrw: target.amountKrw,
        catalogAmountKrw,
        dueDate: new Date(target.dueDate),
        status: 'DRAFT',
        source,
        adjustmentId: target.adjustment?.id ?? null,
      },
    });
    return mapInvoice(row);
  }

  return createInvoiceFromScheduleItem(tenantId, ctx.tenant.plan, ctx.profile, target, source);
}

export async function autoIssueInvoicesForTenant(
  tenantId: string,
  dryRun: boolean,
): Promise<number> {
  const ctx = await loadTenantBillingScheduleContext(tenantId);
  if (!ctx.billingStart || !ctx.profile.autoIssueEnabled) return 0;

  const tenantRow = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { status: true, serviceStartedAt: true },
  });
  if (tenantRow?.status !== 'ACTIVE') return 0;
  if (!ctx.billingStart && !tenantRow.serviceStartedAt) return 0;

  let issued = 0;
  let guard = 0;
  while (guard++ < 24) {
    const fresh = await loadTenantBillingScheduleContext(tenantId);
    const pending = findAutoIssueScheduleItems(fresh.schedule).filter((i) => !i.invoiceId);
    const target = pending[0];
    if (!target) break;

    if (!dryRun) {
      await createInvoiceFromScheduleItem(
        tenantId,
        fresh.tenant.plan,
        fresh.profile,
        target,
        'AUTO',
      );
    }
    issued += 1;
  }
  return issued;
}

export async function ensurePlatformBillingSettings() {
  return prisma.platformBillingSettings.upsert({
    where: { id: 'default' },
    create: { id: 'default' },
    update: {},
  });
}

export async function getPlatformBillingSettings(): Promise<BillingSettingsDto> {
  const row = await ensurePlatformBillingSettings();
  return {
    bankName: row.bankName,
    accountNumber: row.accountNumber,
    accountHolder: row.accountHolder,
    paymentGuideText: row.paymentGuideText,
    overdueGraceDays: row.overdueGraceDays,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function updatePlatformBillingSettings(input: {
  bankName?: string | null;
  accountNumber?: string | null;
  accountHolder?: string | null;
  paymentGuideText?: string | null;
  overdueGraceDays?: number;
}): Promise<BillingSettingsDto> {
  await ensurePlatformBillingSettings();
  const row = await prisma.platformBillingSettings.update({
    where: { id: 'default' },
    data: {
      ...(input.bankName !== undefined ? { bankName: input.bankName?.trim() || null } : {}),
      ...(input.accountNumber !== undefined ? { accountNumber: input.accountNumber?.trim() || null } : {}),
      ...(input.accountHolder !== undefined ? { accountHolder: input.accountHolder?.trim() || null } : {}),
      ...(input.paymentGuideText !== undefined ? { paymentGuideText: input.paymentGuideText?.trim() || null } : {}),
      ...(input.overdueGraceDays !== undefined
        ? { overdueGraceDays: Math.max(0, Math.min(30, Math.floor(input.overdueGraceDays))) }
        : {}),
    },
  });
  return {
    bankName: row.bankName,
    accountNumber: row.accountNumber,
    accountHolder: row.accountHolder,
    paymentGuideText: row.paymentGuideText,
    overdueGraceDays: row.overdueGraceDays,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listTenantInvoices(tenantId: string, limit = 50): Promise<InvoiceDto[]> {
  const rows = await prisma.tenantInvoice.findMany({
    where: { tenantId },
    orderBy: { periodStart: 'desc' },
    take: limit,
  });
  return rows.map(mapInvoice);
}

export async function getTenantBillingSummaryForAdmin(tenantId: string): Promise<TenantBillingSummaryDto> {
  const [tenant, settings, profileRow, invoices, scheduleCtx] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        plan: true,
        status: true,
        trialEndsAt: true,
        prepaidConfirmedAt: true,
        serviceStartedAt: true,
        suspendReason: true,
        billingAccessBlockedAt: true,
      },
    }),
    ensurePlatformBillingSettings(),
    ensureTenantBillingProfile(tenantId),
    prisma.tenantInvoice.findMany({
      where: { tenantId, status: { in: ['ISSUED', 'OVERDUE'] } },
      orderBy: { dueDate: 'asc' },
    }),
    loadTenantBillingScheduleContext(tenantId).catch(() => null),
  ]);
  if (!tenant) throw new TenantNotFoundError();

  const profile = mapBillingProfile(profileRow);
  const amountKrw = resolvePeriodBaseAmountKrw(profile, tenant.plan, profile.billingCycle);
  const catalogMonthlyAmountKrw = calculateBillingAmountKrw(tenant.plan, 'MONTHLY');
  const nextDue = scheduleCtx ? pickNextDueScheduleItem(scheduleCtx.schedule) : null;

  const openInvoice = invoices.find((i) => i.status === 'ISSUED') ?? null;
  const overdueInvoice = invoices.find((i) => i.status === 'OVERDUE') ?? null;
  const billingStartDisplay =
    profile.billingStartDate ?? tenant.serviceStartedAt?.toISOString() ?? null;

  const operationalStatus = resolveTenantBillingOperationalStatus({
    status: tenant.status,
    suspendReason: tenant.suspendReason,
    trialEndsAt: tenant.trialEndsAt,
    prepaidConfirmedAt: tenant.prepaidConfirmedAt,
    serviceStartedAt: tenant.serviceStartedAt,
    billingStartDate: billingStartDisplay,
    billingAccessBlockedAt: tenant.billingAccessBlockedAt,
    hasOpenInvoice: openInvoice != null,
    hasOverdueInvoice: overdueInvoice != null,
  });

  return {
    billingCycle: profile.billingCycle,
    pricingMode: profile.pricingMode,
    customMonthlyAmountKrw: profile.customMonthlyAmountKrw,
    catalogMonthlyAmountKrw,
    trialEndsAt: tenant.trialEndsAt?.toISOString() ?? null,
    prepaidConfirmedAt: tenant.prepaidConfirmedAt?.toISOString() ?? null,
    serviceStartedAt: tenant.serviceStartedAt?.toISOString() ?? null,
    billingStartDate: billingStartDisplay,
    billingDueDay: profile.billingDueDay,
    nextDueDate: nextDue?.dueDate ?? null,
    nextDueAmountKrw: nextDue?.amountKrw ?? null,
    suspendReason: tenant.suspendReason,
    billingAccessBlockedAt: tenant.billingAccessBlockedAt?.toISOString() ?? null,
    amountKrw,
    amountLabel: `${amountKrw.toLocaleString('ko-KR')}원 (VAT 별도)`,
    bank: {
      bankName: settings.bankName,
      accountNumber: settings.accountNumber,
      accountHolder: settings.accountHolder,
      paymentGuideText: settings.paymentGuideText,
    },
    openInvoice: openInvoice ? mapInvoice(openInvoice) : null,
    overdueInvoice: overdueInvoice ? mapInvoice(overdueInvoice) : null,
    operationalStatus,
  };
}

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
  openInvoiceStatus: TenantInvoiceStatus | null;
  openInvoiceDueDate: string | null;
  operationalStatus: TenantBillingOperationalStatus;
};

export async function listTenantsBillingOverview(): Promise<PlatformTenantBillingRow[]> {
  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      slug: true,
      name: true,
      plan: true,
      status: true,
      trialEndsAt: true,
      prepaidConfirmedAt: true,
      serviceStartedAt: true,
      suspendReason: true,
      billingAccessBlockedAt: true,
      billingProfile: true,
      invoices: {
        where: { status: { in: ['ISSUED', 'OVERDUE'] } },
        orderBy: { dueDate: 'asc' },
        take: 1,
        select: { status: true, dueDate: true },
      },
    },
  });

  const rows: PlatformTenantBillingRow[] = [];
  for (const t of tenants) {
    const profile = t.billingProfile
      ? mapBillingProfile(t.billingProfile)
      : mapBillingProfile(await ensureTenantBillingProfile(t.id));
    const contractAmountKrw = resolvePeriodBaseAmountKrw(profile, t.plan, profile.billingCycle);
    let nextDueDate: string | null = null;
    try {
      const ctx = await loadTenantBillingScheduleContext(t.id);
      if (ctx.billingStart) {
        const next = pickNextDueScheduleItem(ctx.schedule);
        nextDueDate = next?.dueDate ?? null;
      }
    } catch {
      nextDueDate = null;
    }
    const openInv = t.invoices[0];
    const operationalStatus = resolveTenantBillingOperationalStatus({
      status: t.status,
      suspendReason: t.suspendReason,
      trialEndsAt: t.trialEndsAt,
      prepaidConfirmedAt: t.prepaidConfirmedAt,
      serviceStartedAt: t.serviceStartedAt,
      billingStartDate: profile.billingStartDate ?? t.serviceStartedAt,
      billingAccessBlockedAt: t.billingAccessBlockedAt,
      hasOpenInvoice: openInv?.status === 'ISSUED',
      hasOverdueInvoice: openInv?.status === 'OVERDUE',
    });
    rows.push({
      tenantId: t.id,
      slug: t.slug,
      name: t.name,
      plan: t.plan,
      status: t.status,
      billingCycle: profile.billingCycle,
      pricingMode: profile.pricingMode,
      contractAmountKrw,
      billingDueDay: profile.billingDueDay,
      serviceStartedAt: t.serviceStartedAt?.toISOString() ?? null,
      nextDueDate,
      trialEndsAt: t.trialEndsAt?.toISOString() ?? null,
      prepaidConfirmedAt: t.prepaidConfirmedAt?.toISOString() ?? null,
      suspendReason: t.suspendReason,
      billingAccessBlockedAt: t.billingAccessBlockedAt?.toISOString() ?? null,
      openInvoiceStatus: t.invoices[0]?.status ?? null,
      openInvoiceDueDate: t.invoices[0]?.dueDate.toISOString() ?? null,
      operationalStatus,
    });
  }
  return rows;
}

export async function getTenantBillingDetailForPlatform(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      slug: true,
      name: true,
      plan: true,
      status: true,
      trialEndsAt: true,
      prepaidConfirmedAt: true,
      serviceStartedAt: true,
      suspendReason: true,
      billingAccessBlockedAt: true,
      createdAt: true,
    },
  });
  if (!tenant) throw new TenantNotFoundError();

  const [profile, invoices, summary, schedulePayload, adjustments] = await Promise.all([
    ensureTenantBillingProfile(tenantId).then(mapBillingProfile),
    listTenantInvoices(tenantId),
    getTenantBillingSummaryForAdmin(tenantId),
    getTenantBillingSchedule(tenantId),
    listTenantBillingAdjustments(tenantId),
  ]);

  return {
    tenant: {
      ...tenant,
      trialEndsAt: tenant.trialEndsAt?.toISOString() ?? null,
      prepaidConfirmedAt: tenant.prepaidConfirmedAt?.toISOString() ?? null,
      serviceStartedAt: tenant.serviceStartedAt?.toISOString() ?? null,
      billingAccessBlockedAt: tenant.billingAccessBlockedAt?.toISOString() ?? null,
      createdAt: tenant.createdAt.toISOString(),
    },
    profile,
    summary,
    invoices,
    schedule: schedulePayload.items,
    adjustments,
  };
}

export async function previewNextInvoice(tenantId: string) {
  const ctx = await loadTenantBillingScheduleContext(tenantId);
  if (!ctx.billingStart) {
    throw new Error('과금 시작일이 없어 청구서를 미리볼 수 없습니다.');
  }
  const pending = findAutoIssueScheduleItems(ctx.schedule).filter((i) => !i.invoiceId);
  const target = pending[0];
  if (!target) {
    throw new Error('다음 청구 기간이 없습니다.');
  }
  return {
    billingCycle: ctx.profile.billingCycle,
    plan: ctx.tenant.plan,
    amountKrw: target.amountKrw,
    periodStart: target.periodStart,
    periodEnd: target.periodEnd,
    dueDate: target.dueDate,
  };
}

export async function confirmPrepaidForTenant(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) throw new TenantNotFoundError();
  if (tenant.prepaidConfirmedAt) {
    throw new Error('이미 사용료 수령이 확인되었습니다.');
  }
  if (tenant.status !== 'TRIAL' && tenant.status !== 'SUSPENDED') {
    throw new Error('체험·중지 상태에서만 선납 확인이 가능합니다.');
  }

  const now = new Date();
  const trialEndsAt = addDaysUtc(now, TENANT_TRIAL_DAYS);
  const updated = await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      prepaidConfirmedAt: now,
      trialEndsAt,
      status: 'TRIAL',
      suspendReason: null,
      billingAccessBlockedAt: null,
      suspendedAt: null,
    },
    select: {
      id: true,
      prepaidConfirmedAt: true,
      trialEndsAt: true,
      status: true,
    },
  });

  const serviceStartsAt = trialEndsAt.toISOString();
  return {
    prepaidConfirmedAt: updated.prepaidConfirmedAt!.toISOString(),
    serviceStartsAt,
    message: `입금 확인되었습니다. ${TENANT_TRIAL_DAYS}일 체험 후 정식 이용·과금이 시작됩니다.`,
  };
}

export async function confirmInvoicePayment(
  invoiceId: string,
  platformUserId: string,
): Promise<InvoiceDto> {
  const invoice = await prisma.tenantInvoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) throw new Error('청구서를 찾을 수 없습니다.');
  if (invoice.status === 'PAID') throw new Error('이미 납부 확인된 청구서입니다.');
  if (invoice.status === 'VOID') throw new Error('무효 처리된 청구서입니다.');

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    const inv = await tx.tenantInvoice.update({
      where: { id: invoiceId },
      data: {
        status: 'PAID',
        paidAt: now,
        confirmedAt: now,
        confirmedByPlatformUserId: platformUserId,
      },
    });

    const stillOverdue = await tx.tenantInvoice.count({
      where: { tenantId: invoice.tenantId, status: 'OVERDUE' },
    });

    if (stillOverdue === 0) {
      await tx.tenant.update({
        where: { id: invoice.tenantId },
        data: {
          billingAccessBlockedAt: null,
          suspendReason: null,
          status: 'ACTIVE',
          suspendedAt: null,
        },
      });
    }

    return inv;
  });

  return mapInvoice(updated);
}

export function trialEndsAtFromCreated(createdAt: Date): Date {
  return addDaysUtc(createdAt, TENANT_TRIAL_DAYS);
}

async function issueFirstInvoiceOnServiceStart(
  tx: Prisma.TransactionClient,
  tenantId: string,
  plan: string,
  serviceStart: Date,
): Promise<boolean> {
  const profileRow = await tx.tenantBillingProfile.findUnique({ where: { tenantId } });
  const profile = mapBillingProfile(
    profileRow ??
      (await tx.tenantBillingProfile.create({
        data: { tenantId, billingStartDate: serviceStart },
      })),
  );

  if (!profileRow?.billingStartDate) {
    const anchorDay = kstDayOfMonthFromDate(serviceStart);
    await tx.tenantBillingProfile.update({
      where: { tenantId },
      data: { billingStartDate: serviceStart, billingDueDay: anchorDay },
    });
  } else {
    await tx.tenantBillingProfile.update({
      where: { tenantId },
      data: { billingDueDay: kstDayOfMonthFromDate(serviceStart) },
    });
  }

  const existing = await tx.tenantInvoice.findFirst({
    where: { tenantId, status: { not: 'VOID' } },
  });
  if (existing) return false;

  const { periodStart, periodEnd } = billingPeriodForStart(serviceStart, profile.billingCycle);
  const amountKrw = resolvePeriodBaseAmountKrw(profile, plan, profile.billingCycle);
  const catalogAmountKrw = calculateBillingAmountKrw(plan, profile.billingCycle);
  await tx.tenantInvoice.create({
    data: {
      tenantId,
      periodStart,
      periodEnd,
      billingCycle: profile.billingCycle,
      plan,
      amountKrw,
      catalogAmountKrw,
      dueDate: dueDateForPeriodStart(periodStart),
      status: 'ISSUED',
      source: 'AUTO',
    },
  });
  return true;
}

export async function runBillingDailyJob(opts?: { dryRun?: boolean }) {
  const dryRun = opts?.dryRun ?? false;
  const settings = await ensurePlatformBillingSettings();
  const graceDays = settings.overdueGraceDays ?? TENANT_BILLING_DEFAULT_GRACE_DAYS;
  const todayYmd = kstYmdFromDate(new Date());
  const todayStart = kstStartOfDayUtc(todayYmd);

  const result = {
    dryRun,
    trialExpired: 0,
    serviceStarted: 0,
    invoicesIssued: 0,
    autoInvoicesIssued: 0,
    markedOverdue: 0,
    billingBlocked: 0,
  };

  const trialExpiredTenants = await prisma.tenant.findMany({
    where: {
      status: 'TRIAL',
      prepaidConfirmedAt: null,
      trialEndsAt: { lt: new Date() },
    },
    select: { id: true },
  });
  for (const t of trialExpiredTenants) {
    result.trialExpired += 1;
    if (!dryRun) {
      await prisma.tenant.update({
        where: { id: t.id },
        data: {
          status: 'SUSPENDED',
          suspendReason: 'TRIAL_EXPIRED',
          billingAccessBlockedAt: new Date(),
          suspendedAt: new Date(),
        },
      });
    }
  }

  const prepaidReady = await prisma.tenant.findMany({
    where: {
      prepaidConfirmedAt: { not: null },
      serviceStartedAt: null,
    },
    select: { id: true, prepaidConfirmedAt: true, trialEndsAt: true, plan: true },
  });
  for (const t of prepaidReady) {
    if (!t.prepaidConfirmedAt) continue;
    const serviceStart = t.trialEndsAt
      ? new Date(t.trialEndsAt)
      : addDaysUtc(t.prepaidConfirmedAt, TENANT_PREPAID_SERVICE_DELAY_DAYS);
    if (serviceStart > new Date()) continue;

    result.serviceStarted += 1;
    if (!dryRun) {
      await prisma.$transaction(async (tx) => {
        await tx.tenant.update({
          where: { id: t.id },
          data: {
            serviceStartedAt: serviceStart,
            status: 'ACTIVE',
            suspendReason: null,
            billingAccessBlockedAt: null,
            suspendedAt: null,
          },
        });
        const created = await issueFirstInvoiceOnServiceStart(tx, t.id, t.plan, serviceStart);
        if (created) result.invoicesIssued += 1;
      });
    }
  }

  const activeTenants = await prisma.tenant.findMany({
    where: {
      status: 'ACTIVE',
      OR: [{ serviceStartedAt: { not: null } }, { billingProfile: { billingStartDate: { not: null } } }],
    },
    select: { id: true },
  });
  for (const t of activeTenants) {
    const n = await autoIssueInvoicesForTenant(t.id, dryRun);
    result.autoInvoicesIssued += n;
  }

  const overdueCandidates = await prisma.tenantInvoice.findMany({
    where: { status: 'ISSUED', dueDate: { lt: todayStart } },
    select: { id: true },
  });
  for (const inv of overdueCandidates) {
    result.markedOverdue += 1;
    if (!dryRun) {
      await prisma.tenantInvoice.update({
        where: { id: inv.id },
        data: { status: 'OVERDUE' },
      });
    }
  }

  const blockThreshold = addDaysUtc(todayStart, -graceDays);
  const blockCandidates = await prisma.tenantInvoice.findMany({
    where: {
      status: 'OVERDUE',
      dueDate: { lt: blockThreshold },
      tenant: { billingAccessBlockedAt: null },
    },
    select: { tenantId: true },
    distinct: ['tenantId'],
  });
  for (const row of blockCandidates) {
    result.billingBlocked += 1;
    if (!dryRun) {
      await prisma.tenant.update({
        where: { id: row.tenantId },
        data: {
          billingAccessBlockedAt: new Date(),
          suspendReason: 'BILLING_OVERDUE',
        },
      });
    }
  }

  return result;
}

export { periodStartKey };
