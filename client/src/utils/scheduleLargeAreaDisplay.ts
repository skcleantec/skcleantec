import type { ScheduleItem } from '../api/schedule';
import { SK_LARGE_AREA_PYEONG_MIN } from '@shared/custom/skcleantecOpsUi';
import { approxPyeongFromExclusiveSqm } from './inquiryAreaDisplay';
import { parseCrewMemberNoteToNames } from './crewMemberNote';
import {
  scheduleItemCountsAsOwnInternalSchedule,
  scheduleItemHasAnyAssignment,
  scheduleItemHasExternalAssignmentOnly,
} from './scheduleOneRoomDisplay';

/** 스케줄 접수 — 표시·집계용 평수 (전용 ㎡만 있으면 근사) */
export function resolveScheduleItemPyeong(
  item: Pick<ScheduleItem, 'areaPyeong' | 'areaBasis' | 'exclusiveAreaSqm'>,
): number | null {
  if (item.areaPyeong != null && Number.isFinite(item.areaPyeong)) {
    return item.areaPyeong;
  }
  const basis = item.areaBasis?.trim() ?? '';
  if (
    basis === '전용' &&
    item.exclusiveAreaSqm != null &&
    Number.isFinite(item.exclusiveAreaSqm)
  ) {
    return approxPyeongFromExclusiveSqm(item.exclusiveAreaSqm);
  }
  return null;
}

export function scheduleItemIsLargeArea40PyeongPlus(
  item: Pick<ScheduleItem, 'areaPyeong' | 'areaBasis' | 'exclusiveAreaSqm'>,
): boolean {
  const py = resolveScheduleItemPyeong(item);
  return py != null && py >= SK_LARGE_AREA_PYEONG_MIN;
}

/** 팀장 배정 + (단독 또는 팀원 N명 이름까지) — SK 40평+ 캘린더 아이콘 제거 기준 */
export function scheduleItemCrewAssignmentComplete(
  item: Pick<ScheduleItem, 'assignments' | 'crewMemberCount' | 'crewMemberNote'>,
): boolean {
  if (!scheduleItemHasAnyAssignment(item)) return false;
  if (scheduleItemHasExternalAssignmentOnly(item)) return true;

  const assignments = item.assignments ?? [];
  const needsCrew = assignments.some((a) => !a.noCrewMembers);
  if (!needsCrew) return true;

  const expected = item.crewMemberCount ?? 0;
  if (expected <= 0) return false;

  const filledNames = parseCrewMemberNoteToNames(item.crewMemberNote).filter((n) => n.trim()).length;
  return filledNames >= expected;
}

export function scheduleItemNeedsLargeAreaCrewIndicator(
  item: Pick<
    ScheduleItem,
    | 'areaPyeong'
    | 'areaBasis'
    | 'exclusiveAreaSqm'
    | 'assignments'
    | 'crewMemberCount'
    | 'crewMemberNote'
    | 'dbListing'
    | 'tenantShare'
  >,
): boolean {
  if (!scheduleItemCountsAsOwnInternalSchedule(item)) return false;
  if (!scheduleItemIsLargeArea40PyeongPlus(item)) return false;
  return !scheduleItemCrewAssignmentComplete(item);
}

/**
 * SK 스케줄 캘린더 — 40평+ 접수 중 팀원 배정이 아직 끝나지 않은 건.
 * 해당 접수의 인원 배정이 완료되면 집계·아이콘에서 제외된다.
 */
export function shouldShowSkLargeAreaCalendarIndicator(items: readonly ScheduleItem[]): {
  show: boolean;
  count: number;
  pendingCrewCount: number;
} {
  const pending = items.filter(scheduleItemNeedsLargeAreaCrewIndicator);
  if (pending.length === 0) {
    return { show: false, count: 0, pendingCrewCount: 0 };
  }
  return { show: true, count: pending.length, pendingCrewCount: pending.length };
}
