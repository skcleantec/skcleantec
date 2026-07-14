import { prisma } from '../../lib/prisma.js';
import { TENANT_BILLING_DEFAULT_GRACE_DAYS } from './tenantBilling.constants.js';
import {
  billingAccessBlockStartsAt,
  kstCalendarDaysUntil,
  kstStartOfDayUtc,
  kstYmdFromDate,
} from './tenantBilling.dates.js';
import { ensurePlatformBillingSettings, type InvoiceDto } from './tenantBilling.service.js';
import { TenantNotFoundError } from '../tenants/tenant.service.js';

export type TenantBillingDunningDto = {
  showDunning: boolean;
  overdueGraceDays: number;
  daysUntilBlock: number | null;
  accessBlockAt: string | null;
  invoice: InvoiceDto | null;
  bank: {
    bankName: string | null;
    accountNumber: string | null;
    accountHolder: string | null;
    paymentGuideText: string | null;
  };
};

function mapInvoiceRow(row: {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  billingCycle: InvoiceDto['billingCycle'];
  plan: string;
  amountKrw: number;
  dueDate: Date;
  status: InvoiceDto['status'];
  source?: InvoiceDto['source'];
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
    source: row.source ?? 'MANUAL',
    paidAt: row.paidAt?.toISOString() ?? null,
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    memo: row.memo,
    createdAt: row.createdAt.toISOString(),
  };
}

const emptyBank = {
  bankName: null as string | null,
  accountNumber: null as string | null,
  accountHolder: null as string | null,
  paymentGuideText: null as string | null,
};

/** ADMIN 로그인 독촉 — 납부기한 경과·차단 전 연체 청구서 */
export async function getTenantBillingDunningForAdmin(tenantId: string): Promise<TenantBillingDunningDto> {
  const [tenant, settings] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, billingAccessBlockedAt: true },
    }),
    ensurePlatformBillingSettings(),
  ]);
  if (!tenant) throw new TenantNotFoundError();

  const graceDays = settings.overdueGraceDays ?? TENANT_BILLING_DEFAULT_GRACE_DAYS;
  const bank = {
    bankName: settings.bankName,
    accountNumber: settings.accountNumber,
    accountHolder: settings.accountHolder,
    paymentGuideText: settings.paymentGuideText,
  };

  if (tenant.billingAccessBlockedAt) {
    return {
      showDunning: false,
      overdueGraceDays: graceDays,
      daysUntilBlock: null,
      accessBlockAt: null,
      invoice: null,
      bank,
    };
  }

  const todayStart = kstStartOfDayUtc(kstYmdFromDate(new Date()));
  const invoiceRow = await prisma.tenantInvoice.findFirst({
    where: {
      tenantId,
      status: { in: ['ISSUED', 'OVERDUE'] },
      dueDate: { lt: todayStart },
    },
    orderBy: { dueDate: 'asc' },
  });

  if (!invoiceRow) {
    return {
      showDunning: false,
      overdueGraceDays: graceDays,
      daysUntilBlock: null,
      accessBlockAt: null,
      invoice: null,
      bank,
    };
  }

  const blockAt = billingAccessBlockStartsAt(invoiceRow.dueDate, graceDays);
  const daysUntilBlock = Math.max(0, kstCalendarDaysUntil(new Date(), blockAt));

  return {
    showDunning: true,
    overdueGraceDays: graceDays,
    daysUntilBlock,
    accessBlockAt: blockAt.toISOString(),
    invoice: mapInvoiceRow(invoiceRow),
    bank,
  };
}
