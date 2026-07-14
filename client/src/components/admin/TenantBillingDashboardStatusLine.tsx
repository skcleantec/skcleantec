import type { TenantBillingSummary } from '../../api/tenantBilling';
import {
  formatTenantBillingDashboardLine,
  resolveTenantBillingDashboardDisplay,
  type TenantBillingDashboardTone,
} from '@shared/tenantBillingDashboardDisplay';
import type { TenantBillingOperationalStatusCode } from '@shared/tenantBilling';

const TONE_CLASS: Record<TenantBillingDashboardTone, string> = {
  ok: 'text-emerald-700',
  warn: 'text-amber-800 hover:text-amber-950',
  danger: 'text-rose-700 hover:text-rose-900',
  muted: 'text-slate-600',
};

type Props = {
  billing: TenantBillingSummary;
  className?: string;
  textClassName?: string;
  onUnpaidClick?: () => void;
};

export function TenantBillingDashboardStatusLine({
  billing,
  className = '',
  textClassName = '',
  onUnpaidClick,
}: Props) {
  const display = resolveTenantBillingDashboardDisplay({
    operationalStatus: {
      ...billing.operationalStatus,
      code: billing.operationalStatus.code as TenantBillingOperationalStatusCode,
    },
    trialEndsAt: billing.trialEndsAt,
    prepaidConfirmedAt: billing.prepaidConfirmedAt,
    currentPeriodStart: billing.currentPeriodStart ?? null,
    currentPeriodEnd: billing.currentPeriodEnd ?? null,
    openInvoice: billing.openInvoice,
    overdueInvoice: billing.overdueInvoice,
  });
  const line = formatTenantBillingDashboardLine(display);
  const toneClass = TONE_CLASS[display.tone];

  if (display.clickable) {
    return (
      <div className={className}>
        <button
          type="button"
          onClick={onUnpaidClick}
          className={`text-left text-[clamp(0.6875rem,1.55vw,0.8125rem)] font-semibold underline decoration-dotted underline-offset-2 ${toneClass} ${textClassName}`}
        >
          {line}
        </button>
      </div>
    );
  }

  return (
    <p
      className={`text-[clamp(0.6875rem,1.55vw,0.8125rem)] font-semibold leading-snug ${toneClass} ${className} ${textClassName}`}
    >
      {line}
    </p>
  );
}
