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
  variant?: 'block' | 'inline';
  onUnpaidClick?: () => void;
};

const COMPACT_TEXT =
  'text-[clamp(0.5625rem,1.15vw,0.625rem)] font-medium leading-none';

export function TenantBillingDashboardStatusLine({
  billing,
  className = '',
  textClassName = '',
  variant = 'block',
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
  const sizeClass = variant === 'inline' ? COMPACT_TEXT : 'text-[clamp(0.6875rem,1.55vw,0.8125rem)] font-semibold leading-snug';
  const combinedClass = `${sizeClass} ${toneClass} ${textClassName}`.trim();

  if (display.clickable) {
    const btn = (
      <button
        type="button"
        onClick={onUnpaidClick}
        title={line}
        className={`text-left underline decoration-dotted underline-offset-2 ${combinedClass} ${
          variant === 'inline' ? 'min-w-0 truncate' : ''
        }`}
      >
        {line}
      </button>
    );
    if (variant === 'inline') {
      return <span className={`min-w-0 ${className}`.trim()}>{btn}</span>;
    }
    return <div className={className}>{btn}</div>;
  }

  const text = (
    <span title={line} className={variant === 'inline' ? 'min-w-0 truncate block' : undefined}>
      {line}
    </span>
  );

  if (variant === 'inline') {
    return (
      <span className={`min-w-0 truncate ${combinedClass} ${className}`.trim()} title={line}>
        {line}
      </span>
    );
  }

  return <p className={`${combinedClass} ${className}`.trim()}>{text}</p>;
}
