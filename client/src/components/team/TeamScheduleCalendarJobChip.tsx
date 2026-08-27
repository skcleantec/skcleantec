import type { InquiryItem } from '../../pages/team/teamInquiryShared';
import {
  teamScheduleCalendarHappyCallBorderClass,
  teamScheduleCalendarJobChipDisplayText,
  teamScheduleCalendarJobLabel,
} from '../../utils/teamScheduleCalendarCell';

type Props = {
  item: InquiryItem;
  onOpenDetail: (item: InquiryItem) => void;
};

export function TeamScheduleCalendarJobChip({ item, onOpenDetail }: Props) {
  const title = teamScheduleCalendarJobLabel(item);
  const displayText = teamScheduleCalendarJobChipDisplayText(item);
  const borderClass = teamScheduleCalendarHappyCallBorderClass(item);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onOpenDetail(item);
      }}
      className={`team-schedule-mobile-cal-chip w-full min-w-0 overflow-hidden text-ellipsis whitespace-nowrap rounded border px-0.5 py-0.5 text-left touch-manipulation hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-1 ${borderClass}`}
      title={title}
      aria-label={title}
    >
      {displayText}
    </button>
  );
}

type OverflowProps = {
  count: number;
};

/** 4건 초과분 — 셀 탭(일별 목록)과 동일하게 버블업 */
export function TeamScheduleCalendarJobOverflowChip({ count }: OverflowProps) {
  if (count <= 0) return null;
  return (
    <span
      className="team-schedule-mobile-cal-chip block w-full min-w-0 truncate rounded border border-dashed border-blue-300 bg-blue-50/90 px-0.5 py-0.5 text-center text-blue-700 tabular-nums"
      aria-hidden
    >
      +{count}
    </span>
  );
}
