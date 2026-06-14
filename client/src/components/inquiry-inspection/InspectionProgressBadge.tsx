import {
  INSPECTION_STATUS_LABELS,
  type InspectionListSummary,
} from '../../api/inquiryInspection';

export function formatInspectionProgressLine(summary: InspectionListSummary): string {
  if (summary.status === 'COMPLETED') {
    return `완료 ${summary.itemsComplete}/${summary.itemsTotal}`;
  }
  return `전 ${summary.beforeDone}/${summary.beforeTotal} · 후 ${summary.afterDone}/${summary.afterTotal}`;
}

export function InspectionProgressBadge({
  summary,
  variant = 'default',
  className = '',
}: {
  summary: InspectionListSummary | null | undefined;
  variant?: 'default' | 'list';
  className?: string;
}) {
  if (!summary) {
    if (variant === 'list') {
      return <span className={`text-fluid-xs text-gray-400 tabular-nums ${className}`}>—</span>;
    }
    return null;
  }

  const label = INSPECTION_STATUS_LABELS[summary.status] ?? summary.status;
  const progress = formatInspectionProgressLine(summary);

  if (variant === 'list') {
    if (summary.status === 'COMPLETED') {
      return (
        <span className={`text-fluid-xs font-medium text-emerald-700 ${className}`} title={progress}>
          검수완료
        </span>
      );
    }
    if (summary.status === 'VOID') {
      return (
        <span className={`text-fluid-xs font-medium text-rose-700 ${className}`} title={label}>
          검수무효
        </span>
      );
    }
    return (
      <span className={`text-fluid-xs font-medium text-amber-800 tabular-nums ${className}`} title={label}>
        {progress}
      </span>
    );
  }

  const tone =
    summary.status === 'COMPLETED'
      ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
      : summary.status === 'VOID'
        ? 'bg-rose-50 text-rose-900 border-rose-200'
        : summary.status === 'NOT_STARTED'
          ? 'bg-slate-50 text-slate-700 border-slate-200'
          : 'bg-amber-50 text-amber-900 border-amber-200';

  return (
    <span
      className={`inline-flex max-w-full flex-col items-start gap-0.5 rounded-md border px-2 py-0.5 text-fluid-2xs font-medium shrink-0 ${tone} ${className}`}
      title={`현장 검수: ${label}`}
    >
      <span>검수 {label}</span>
      <span className="tabular-nums font-normal opacity-90">{progress}</span>
    </span>
  );
}
