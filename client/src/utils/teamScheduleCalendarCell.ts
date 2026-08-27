import { inquiryPrimaryCustomerLabel } from './inquiryListDisplay';
import { isHappyCallEligible } from './happyCall';
import type { InquiryItem } from '../pages/team/teamInquiryShared';
import { formatTeamInquiryAreaCompact } from '../pages/team/teamInquiryShared';

/** 캘린더 셀 chip — 해피콜 완료 초록 / 미완(마감 전 대기 포함) 빨강 / 비대상·미배정 테두리 없음 */
export function teamScheduleCalendarHappyCallBorderClass(item: InquiryItem): string {
  const hasAssignment = item.assignments.length > 0;
  if (!hasAssignment || !isHappyCallEligible(item.status, item.preferredDate)) {
    return 'border-transparent bg-white/90 text-gray-800 shadow-sm ring-1 ring-gray-200/80';
  }
  if (item.happyCallCompletedAt) {
    return 'border-green-500 bg-green-50/90 text-green-900';
  }
  return 'border-red-500 bg-red-50/90 text-red-900';
}

/** 모바일 캘린더 chip 한 줄 — title용 「고객명 34평」 */
export function teamScheduleCalendarJobLabel(item: InquiryItem): string {
  const name = inquiryPrimaryCustomerLabel(item);
  const area = formatTeamInquiryAreaCompact(item);
  return area ? `${name} ${area}` : name;
}

/** 칸 안 표시 — 이름만(평수는 title·상세). 좁은 7열 그리드용 */
export function teamScheduleCalendarJobChipDisplayText(item: InquiryItem): string {
  return inquiryPrimaryCustomerLabel(item);
}

export const TEAM_SCHEDULE_CALENDAR_MAX_VISIBLE_CHIPS = 4;
