import type { OrderFollowupItem } from '../../api/orderFollowups';
import { CrmHoverTextPreview } from '../crm/CrmHoverTextPreview';
import {
  ORDER_FOLLOWUP_STATUS_LABEL,
  type OrderFollowupStatus,
} from '../../constants/orderFollowupStatus';
import { formatDateCompactWithWeekday } from '../../utils/dateFormat';

export function displayFollowupPhone(phone: string | null | undefined): string {
  const t = phone?.trim() ?? '';
  return t ? t : '—';
}

export function followupLeadSourceLabel(row: OrderFollowupItem): string {
  const fromInquiry = row.inquiry?.source?.trim();
  if (fromInquiry) return fromInquiry;
  const direct = row.leadSource?.trim();
  return direct || '—';
}

function statusToneClass(status: OrderFollowupStatus): string {
  return status === 'FULFILLED'
    ? 'bg-emerald-50 text-emerald-900 border border-emerald-200'
    : status === 'RESERVED'
      ? 'bg-blue-50 text-blue-900 border border-blue-200'
      : status === 'REQUESTED'
        ? 'bg-sky-50 text-sky-950 border border-sky-200'
        : status === 'ON_HOLD'
          ? 'bg-amber-50 text-amber-950 border border-amber-200'
          : status === 'DEPOSIT_PENDING'
            ? 'bg-orange-50 text-orange-900 border border-orange-200'
            : 'bg-gray-100 text-gray-800 border border-gray-200';
}

const STATUS_BADGE_BASE =
  'inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold tabular-nums';

export function FollowupStatusBadge({ status }: { status: OrderFollowupStatus }) {
  return (
    <span className={`${STATUS_BADGE_BASE} ${statusToneClass(status)}`}>
      {ORDER_FOLLOWUP_STATUS_LABEL[status]}
    </span>
  );
}

export function FollowupStatusBadgeWithMemo({
  row,
  onOpenMemo,
}: {
  row: OrderFollowupItem;
  onOpenMemo?: (row: OrderFollowupItem) => void;
}) {
  const memo = row.memo?.trim();
  if (!memo || !onOpenMemo) {
    return <FollowupStatusBadge status={row.status} />;
  }
  const preview = memo.length > 140 ? `${memo.slice(0, 140)}…` : memo;
  return (
    <span className="relative group inline-flex">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenMemo(row);
        }}
        aria-label={`${ORDER_FOLLOWUP_STATUS_LABEL[row.status]} · 메모 보기`}
        className={`${STATUS_BADGE_BASE} ${statusToneClass(
          row.status,
        )} cursor-pointer pr-1.5 ring-offset-1 hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400`}
      >
        <span>{ORDER_FOLLOWUP_STATUS_LABEL[row.status]}</span>
        <svg
          className="ml-0.5 h-3 w-3 opacity-70"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <path d="M4 5h16v11H7l-3 3V5z" />
        </svg>
      </button>
      <span className="pointer-events-none absolute right-0 left-auto top-full z-30 mt-1 hidden w-64 max-w-[min(18rem,80vw)] whitespace-pre-wrap break-all rounded-md border border-gray-200 bg-white px-3 py-2 text-left text-[11px] leading-5 text-gray-700 shadow-lg group-hover:block">
        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-gray-400">
          메모
        </span>
        {preview}
      </span>
    </span>
  );
}

export function FollowupMemoCell({
  row,
  onOpenMemo,
}: {
  row: OrderFollowupItem;
  onOpenMemo?: (row: OrderFollowupItem) => void;
}) {
  const memo = row.memo?.trim();
  if (!memo) {
    return <span className="text-slate-300">—</span>;
  }
  const short = memo.length > 56 ? `${memo.slice(0, 56)}…` : memo;
  if (!onOpenMemo) {
    return <span className="block truncate text-[11px] text-slate-700">{short}</span>;
  }
  return (
    <CrmHoverTextPreview text={memo} label="메모 · 숨고 요청·견적">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpenMemo(row);
        }}
        className="mx-auto block max-w-full truncate text-[11px] text-slate-700 hover:text-sky-800"
      >
        {short}
      </button>
    </CrmHoverTextPreview>
  );
}

export function followupRowGoldClass(goldDb: boolean, selected: boolean): string {
  if (selected) return 'bg-amber-50 ring-1 ring-inset ring-amber-300';
  if (goldDb) return 'bg-amber-50/40 border-l-[3px] border-l-amber-500';
  return 'hover:bg-slate-50/80';
}

export { formatDateCompactWithWeekday };
