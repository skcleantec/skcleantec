import { INSPECTION_STATUS_LABELS, type InspectionStatus } from '../../api/inquiryInspection';

export type InspectionCsSummary = {
  status: InspectionStatus;
  completedAt?: string | null;
  emailSentAt?: string | null;
};

export function InspectionCsSummaryBadge({ summary }: { summary: InspectionCsSummary | null | undefined }) {
  if (!summary) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-fluid-2xs font-medium text-slate-600">
        현장 검수: 없음
      </span>
    );
  }
  const label = INSPECTION_STATUS_LABELS[summary.status] ?? summary.status;
  const tone =
    summary.status === 'COMPLETED'
      ? 'bg-emerald-100 text-emerald-900'
      : summary.status === 'VOID'
        ? 'bg-rose-100 text-rose-900'
        : summary.status === 'IN_PROGRESS' || summary.status === 'AWAITING_CUSTOMER'
          ? 'bg-amber-100 text-amber-900'
          : 'bg-slate-100 text-slate-700';

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-fluid-2xs font-medium ${tone}`}>
      현장 검수: {label}
      {summary.status === 'COMPLETED' && summary.emailSentAt ? ' · 메일 발송됨' : ''}
    </span>
  );
}
