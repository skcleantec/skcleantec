import type { OpsHourlyMetricId, OpsHourlySummary } from '../api/dashboard';

export function buildOpsDrillDownUrl(
  metricId: OpsHourlyMetricId,
  summary: OpsHourlySummary,
  hour?: number,
): string {
  const metric = summary.metrics.find((m) => m.id === metricId);
  const h = hour ?? metric?.peakHour ?? 0;
  const qs = new URLSearchParams({
    fromYmd: summary.periodStartYmd,
    toYmd: summary.periodEndYmd,
    kstHour: String(h),
    opsDrill: '1',
  });

  switch (metricId) {
    case 'order_form_issued':
      return `/admin/inquiries/order-forms?${qs}`;
    case 'order_form_submitted':
      qs.set('kstTimeField', 'submitted');
      qs.set('submitStatus', 'submitted');
      return `/admin/inquiries/order-forms?${qs}`;
    case 'inquiry_received':
      qs.set('statusEvent', 'RECEIVED');
      return `/admin/inquiries?${qs}`;
    case 'followup_absent':
      qs.set('status', 'ABSENT');
      return `/admin/inquiries/followup?${qs}`;
    case 'followup_on_hold':
      qs.set('status', 'ON_HOLD');
      return `/admin/inquiries/followup?${qs}`;
    case 'followup_reserved':
      qs.set('status', 'RESERVED');
      return `/admin/inquiries/followup?${qs}`;
    default:
      return `/admin/inquiries/order-forms?${qs}`;
  }
}

export function opsDrillBannerLabel(params: {
  fromYmd: string;
  toYmd: string;
  kstHour: string;
  label?: string;
}): string {
  const h = parseInt(params.kstHour, 10);
  const hourLabel = Number.isFinite(h) ? `${h}~${h === 23 ? 0 : h + 1}시` : params.kstHour;
  const prefix = params.label ? `${params.label} · ` : '';
  return `${prefix}${params.fromYmd}~${params.toYmd} · ${hourLabel} (KST)`;
}
