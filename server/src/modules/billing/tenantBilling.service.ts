import type { TenantBillingCycle, TenantInvoiceStatus, TenantSuspendReason } from '@prisma/client';
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
  dueDateFromPeriodStart,
  kstStartOfDayUtc,
  kstYmdFromDate,
} from './tenantBilling.dates.js';
import { TenantNotFoundError } from '../tenants/tenant.service.js';

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
  paidAt: string | null;
  confirmedAt: string | null;
  memo: string | null;
  createdAt: string;
};

export type TenantBillingSummaryDto = {
  billingCycle: TenantBillingCycle;
  trialEndsAt: string | null;
  prepaidConfirmedAt: string | null;
  serviceStartedAt: string | null;
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
    paidAt: row.paidAt?.toISOString() ?? null,
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    memo: row.memo,
    createdAt: row.createdAt.toISOString(),
  };
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

export async function ensureTenantBillingProfile(tenantId: string, cycle: TenantBillingCycle = 'MONTHLY') {
  return prisma.tenantBillingProfile.upsert({
    where: { tenantId },
    create: { tenantId, billingCycle: cycle },
    update: {},
  });
}

export async function getTenantBillingCycle(tenantId: string): Promise<TenantBillingCycle> {
  const profile = await ensureTenantBillingProfile(tenantId);
  return profile.billingCycle;
}

export async function updateTenantBillingProfile(
  tenantId: string,
  billingCycle: TenantBillingCycle,
): Promise<{ billingCycle: TenantBillingCycle }> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
  if (!tenant) throw new TenantNotFoundError();
  const profile = await prisma.tenantBillingProfile.upsert({
    where: { tenantId },
    create: { tenantId, billingCycle },
    update: { billingCycle },
  });
  return { billingCycle: profile.billingCycle };
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
  const [tenant, settings, profile, invoices] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        plan: true,
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
  ]);
  if (!tenant) throw new TenantNotFoundError();

  const amountKrw = calculateBillingAmountKrw(tenant.plan, profile.billingCycle);
  const openInvoice = invoices.find((i) => i.status === 'ISSUED') ?? null;
  const overdueInvoice = invoices.find((i) => i.status === 'OVERDUE') ?? null;

  return {
    billingCycle: profile.billingCycle,
    trialEndsAt: tenant.trialEndsAt?.toISOString() ?? null,
    prepaidConfirmedAt: tenant.prepaidConfirmedAt?.toISOString() ?? null,
    serviceStartedAt: tenant.serviceStartedAt?.toISOString() ?? null,
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
  };
}

export type PlatformTenantBillingRow = {
  tenantId: string;
  slug: string;
  name: string;
  plan: string;
  status: string;
  billingCycle: TenantBillingCycle;
  trialEndsAt: string | null;
  prepaidConfirmedAt: string | null;
  serviceStartedAt: string | null;
  suspendReason: TenantSuspendReason | null;
  billingAccessBlockedAt: string | null;
  openInvoiceStatus: TenantInvoiceStatus | null;
  openInvoiceDueDate: string | null;
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
      billingProfile: { select: { billingCycle: true } },
      invoices: {
        where: { status: { in: ['ISSUED', 'OVERDUE'] } },
        orderBy: { dueDate: 'asc' },
        take: 1,
        select: { status: true, dueDate: true },
      },
    },
  });

  return tenants.map((t) => ({
    tenantId: t.id,
    slug: t.slug,
    name: t.name,
    plan: t.plan,
    status: t.status,
    billingCycle: t.billingProfile?.billingCycle ?? 'MONTHLY',
    trialEndsAt: t.trialEndsAt?.toISOString() ?? null,
    prepaidConfirmedAt: t.prepaidConfirmedAt?.toISOString() ?? null,
    serviceStartedAt: t.serviceStartedAt?.toISOString() ?? null,
    suspendReason: t.suspendReason,
    billingAccessBlockedAt: t.billingAccessBlockedAt?.toISOString() ?? null,
    openInvoiceStatus: t.invoices[0]?.status ?? null,
    openInvoiceDueDate: t.invoices[0]?.dueDate.toISOString() ?? null,
  }));
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

  const [profile, invoices, summary] = await Promise.all([
    ensureTenantBillingProfile(tenantId),
    listTenantInvoices(tenantId),
    getTenantBillingSummaryForAdmin(tenantId),
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
    profile: { billingCycle: profile.billingCycle },
    summary,
    invoices,
  };
}

export async function previewNextInvoice(tenantId: string) {
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, plan: true, serviceStartedAt: true },
  });
  if (!tenant) throw new TenantNotFoundError();
  const cycle = await getTenantBillingCycle(tenantId);

  const lastInvoice = await prisma.tenantInvoice.findFirst({
    where: { tenantId, status: { not: 'VOID' } },
    orderBy: { periodEnd: 'desc' },
  });

  let periodStart: Date;
  if (lastInvoice) {
    periodStart = new Date(lastInvoice.periodEnd.getTime() + 1);
  } else if (tenant.serviceStartedAt) {
    periodStart = tenant.serviceStartedAt;
  } else {
    throw new Error('서비스 시작일이 없어 청구서를 미리볼 수 없습니다.');
  }

  const { periodStart: ps, periodEnd } = billingPeriodForStart(periodStart, cycle);
  const amountKrw = calculateBillingAmountKrw(tenant.plan, cycle);
  const dueDate = dueDateFromPeriodStart(ps);

  return {
    billingCycle: cycle,
    plan: tenant.plan,
    amountKrw,
    periodStart: ps.toISOString(),
    periodEnd: periodEnd.toISOString(),
    dueDate: dueDate.toISOString(),
  };
}

export async function issueInvoiceForTenant(tenantId: string, asDraft = false): Promise<InvoiceDto> {
  const preview = await previewNextInvoice(tenantId);
  const existing = await prisma.tenantInvoice.findFirst({
    where: {
      tenantId,
      periodStart: new Date(preview.periodStart),
      status: { not: 'VOID' },
    },
  });
  if (existing) {
    throw new Error('해당 기간 청구서가 이미 있습니다.');
  }

  const row = await prisma.tenantInvoice.create({
    data: {
      tenantId,
      periodStart: new Date(preview.periodStart),
      periodEnd: new Date(preview.periodEnd),
      billingCycle: preview.billingCycle,
      plan: preview.plan,
      amountKrw: preview.amountKrw,
      dueDate: new Date(preview.dueDate),
      status: asDraft ? 'DRAFT' : 'ISSUED',
    },
  });
  return mapInvoice(row);
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
  const updated = await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      prepaidConfirmedAt: now,
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

  const serviceStartsAt = addDaysUtc(now, TENANT_PREPAID_SERVICE_DELAY_DAYS);
  return {
    prepaidConfirmedAt: updated.prepaidConfirmedAt!.toISOString(),
    serviceStartsAt: serviceStartsAt.toISOString(),
    message: `사용료 수령 확인되었습니다. ${TENANT_PREPAID_SERVICE_DELAY_DAYS}일 후 서비스가 시작되고 첫 청구서가 발행됩니다.`,
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
    markedOverdue: 0,
    billingBlocked: 0,
  };

  // 1) Trial expiry without prepaid
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

  // 2) Prepaid + 7 days → ACTIVE + first invoice
  const prepaidReady = await prisma.tenant.findMany({
    where: {
      prepaidConfirmedAt: { not: null },
      serviceStartedAt: null,
    },
    select: { id: true, prepaidConfirmedAt: true, plan: true },
  });
  for (const t of prepaidReady) {
    if (!t.prepaidConfirmedAt) continue;
    const serviceStart = addDaysUtc(t.prepaidConfirmedAt, TENANT_PREPAID_SERVICE_DELAY_DAYS);
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

        const cycle = (
          await tx.tenantBillingProfile.findUnique({ where: { tenantId: t.id } })
        )?.billingCycle ?? 'MONTHLY';

        const existing = await tx.tenantInvoice.findFirst({
          where: { tenantId: t.id, status: { not: 'VOID' } },
        });
        if (!existing) {
          const { periodStart, periodEnd } = billingPeriodForStart(serviceStart, cycle);
          const amountKrw = calculateBillingAmountKrw(t.plan, cycle);
          await tx.tenantInvoice.create({
            data: {
              tenantId: t.id,
              periodStart,
              periodEnd,
              billingCycle: cycle,
              plan: t.plan,
              amountKrw,
              dueDate: dueDateFromPeriodStart(periodStart),
              status: 'ISSUED',
            },
          });
          result.invoicesIssued += 1;
        }
      });
    }
  }

  // 3) ISSUED → OVERDUE
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

  // 4) OVERDUE + grace → billing block
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
