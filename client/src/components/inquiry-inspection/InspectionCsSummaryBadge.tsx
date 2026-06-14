import {
  INSPECTION_STATUS_LABELS,
  type InspectionListSummary,
  type InspectionStatus,
} from '../../api/inquiryInspection';
import { formatInspectionProgressLine } from './InspectionProgressBadge';

export type InspectionCsSummary = {
  status: InspectionStatus;
  completedAt?: string | null;
  emailSentAt?: string | null;
  /** 서버 inspectionSummary — C/S 연결 접수 */
  beforeDone?: number;
  beforeTotal?: number;
  afterDone?: number;
  afterTotal?: number;
  itemsComplete?: number;
  itemsTotal?: number;
};

function toProgressSummary(summary: InspectionCsSummary): InspectionListSummary | null {
  if (summary.afterTotal == null || summary.beforeTotal == null) return null;
  return {
    status: summary.status,
    completedAt: summary.completedAt ?? null,
    emailSentAt: summary.emailSentAt ?? null,
    hasPdf: false,
    beforeDone: summary.beforeDone ?? 0,
    beforeTotal: summary.beforeTotal,
    afterDone: summary.afterDone ?? 0,
    afterTotal: summary.afterTotal,
    itemsComplete: summary.itemsComplete ?? 0,
    itemsTotal: summary.itemsTotal ?? summary.afterTotal,
  };
}

export function InspectionCsSummaryBadge({ summary }: { summary: InspectionCsSummary | null | undefined }) {
  if (!summary) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-fluid-2xs font-medium text-slate-600">
        현장 검수: 없음
      </span>
    );
  }
  const label = INSPECTION_STATUS_LABELS[summary.status] ?? summary.status;
  const progressSummary = toProgressSummary(summary);
  const progressLine = progressSummary ? formatInspectionProgressLine(progressSummary) : null;
  const tone =
    summary.status === 'COMPLETED'
      ? 'bg-emerald-100 text-emerald-900'
      : summary.status === 'VOID'
        ? 'bg-rose-100 text-rose-900'
        : summary.status === 'IN_PROGRESS' || summary.status === 'AWAITING_CUSTOMER'
          ? 'bg-amber-100 text-amber-900'
          : 'bg-slate-100 text-slate-700';

  return (
    <span className={`inline-flex flex-col items-start gap-0.5 rounded-lg px-2 py-1 text-fluid-2xs font-medium ${tone}`}>
      <span>
        현장 검수: {label}
        {summary.status === 'COMPLETED' && summary.emailSentAt ? ' · 메일 발송됨' : ''}
      </span>
      {progressLine && summary.status !== 'COMPLETED' && summary.status !== 'VOID' ? (
        <span className="tabular-nums font-normal opacity-90">{progressLine}</span>
      ) : null}
      {progressLine && summary.status === 'COMPLETED' ? (
        <span className="tabular-nums font-normal opacity-90">{progressLine}</span>
      ) : null}
    </span>
  );
}
