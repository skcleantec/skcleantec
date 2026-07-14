import type { TenantBillingOperationalStatus, TenantBillingOperationalStatusCode } from './tenantBilling.js';

export type TenantBillingDashboardTone = 'ok' | 'warn' | 'danger' | 'muted';

export type TenantBillingDashboardDisplay = {
  statusLabel: string;
  periodLabel: string | null;
  tone: TenantBillingDashboardTone;
  clickable: boolean;
};

export function formatBillingDashboardDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatBillingPeriodRangeLabel(startIso: string, endIso: string): string {
  return `${formatBillingDashboardDate(startIso)} ~ ${formatBillingDashboardDate(endIso)}`;
}

const UNPAID_CODES: TenantBillingOperationalStatusCode[] = [
  'ACTIVE_BILLED',
  'ACTIVE_OVERDUE',
  'ACTIVE_BLOCKED',
];

function periodFromInvoice(invoice: { periodStart: string; periodEnd: string } | null | undefined) {
  if (!invoice) return null;
  return formatBillingPeriodRangeLabel(invoice.periodStart, invoice.periodEnd);
}

export function resolveTenantBillingDashboardDisplay(input: {
  operationalStatus: TenantBillingOperationalStatus;
  trialEndsAt: string | null;
  prepaidConfirmedAt: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  openInvoice: { periodStart: string; periodEnd: string } | null;
  overdueInvoice: { periodStart: string; periodEnd: string } | null;
}): TenantBillingDashboardDisplay {
  const { code, label } = input.operationalStatus;
  const unpaidInvoice = input.overdueInvoice ?? input.openInvoice;
  const currentPeriod =
    input.currentPeriodStart && input.currentPeriodEnd
      ? formatBillingPeriodRangeLabel(input.currentPeriodStart, input.currentPeriodEnd)
      : null;
  const trialPeriod =
    input.prepaidConfirmedAt && input.trialEndsAt
      ? formatBillingPeriodRangeLabel(input.prepaidConfirmedAt, input.trialEndsAt)
      : null;

  if (UNPAID_CODES.includes(code) && unpaidInvoice) {
    return {
      statusLabel: '미입금 상태(입금요망)',
      periodLabel: periodFromInvoice(unpaidInvoice),
      tone: code === 'ACTIVE_BILLED' ? 'warn' : 'danger',
      clickable: true,
    };
  }

  if (code === 'TRIAL_UNPAID') {
    return {
      statusLabel: '미입금 상태(입금요망)',
      periodLabel: null,
      tone: 'warn',
      clickable: true,
    };
  }

  if (code === 'ACTIVE_OK') {
    return {
      statusLabel: '정상',
      periodLabel: currentPeriod,
      tone: 'ok',
      clickable: false,
    };
  }

  if (code === 'TRIAL_PAID') {
    return {
      statusLabel: '체험 중',
      periodLabel: trialPeriod,
      tone: 'muted',
      clickable: false,
    };
  }

  if (code === 'PENDING_START') {
    return {
      statusLabel: label,
      periodLabel: input.trialEndsAt ? formatBillingDashboardDate(input.trialEndsAt) : null,
      tone: 'muted',
      clickable: false,
    };
  }

  if (code === 'SUSPENDED') {
    return {
      statusLabel: label,
      periodLabel: null,
      tone: 'danger',
      clickable: false,
    };
  }

  return {
    statusLabel: label,
    periodLabel: currentPeriod ?? trialPeriod,
    tone: 'muted',
    clickable: false,
  };
}

export function formatTenantBillingDashboardLine(display: TenantBillingDashboardDisplay): string {
  if (display.periodLabel) {
    return `${display.statusLabel} ${display.periodLabel}`;
  }
  return display.statusLabel;
}
