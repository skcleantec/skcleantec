import type { ScheduleItem } from '../api/schedule';
import { detectOneRoomFromNotes } from './orderFormOneRoom';

/** 스케줄 캘린더 — 당일 접수가 원/투룸(`isOneRoom`)인지 (레거시 특이사항·prefill fallback 포함) */
export function scheduleItemIsOneRoom(
  item: Pick<ScheduleItem, 'isOneRoom' | 'specialNotes'> & {
    orderForm?: {
      customerSpecialNotes?: string | null;
      prefillAnswers?: Record<string, unknown> | null;
    } | null;
  },
): boolean {
  if (Boolean(item.isOneRoom)) return true;
  const prefillOneRoom = item.orderForm?.prefillAnswers?.isOneRoom;
  if (prefillOneRoom === true || prefillOneRoom === 'true' || prefillOneRoom === 1) {
    return true;
  }
  const notes =
    item.orderForm?.customerSpecialNotes?.trim() ||
    item.specialNotes?.trim() ||
    '';
  return detectOneRoomFromNotes(notes);
}

/** 팀장·타업체 포함 담당자 1명 이상 배정됨 */
export function scheduleItemHasAnyAssignment(
  item: Pick<ScheduleItem, 'assignments'>,
): boolean {
  return (item.assignments?.length ?? 0) > 0;
}

/** 자사 팀장(TEAM_LEADER) 배정 여부 — 타업체만 배정된 건은 false */
export function scheduleItemHasInternalTeamLeaderAssignment(
  item: Pick<ScheduleItem, 'assignments'>,
): boolean {
  return (item.assignments ?? []).some((a) => a.teamLeader.role === 'TEAM_LEADER');
}

/** 타업체만 배정(자사 팀장 없음) */
export function scheduleItemHasExternalAssignmentOnly(
  item: Pick<ScheduleItem, 'assignments'>,
): boolean {
  const list = item.assignments ?? [];
  return list.length > 0 && !scheduleItemHasInternalTeamLeaderAssignment(item);
}

/** 타업체에만 넘긴 원/투룸 — 자사 인원·태극기 집계에서 제외 */
export function scheduleOneRoomExcludedFromInternalTaegeukCount(
  item: Pick<ScheduleItem, 'assignments'>,
): boolean {
  return scheduleItemHasExternalAssignmentOnly(item);
}

/** 태극기·자사 인원 집계에 포함할 원/투룸(미배정 + 자사 팀장 배정) */
export function scheduleOneRoomItemForInternalTaegeuk(
  item: Pick<ScheduleItem, 'isOneRoom' | 'specialNotes' | 'assignments'> & {
    orderForm?: {
      customerSpecialNotes?: string | null;
      prefillAnswers?: Record<string, unknown> | null;
    } | null;
  },
): boolean {
  if (!scheduleItemIsOneRoom(item)) return false;
  if (scheduleOneRoomExcludedFromInternalTaegeukCount(item)) return false;
  return true;
}

export function countScheduleOneRoomItems(items: readonly ScheduleItem[]): number {
  return items.filter(scheduleItemIsOneRoom).length;
}

/**
 * SK 스케줄 캘린더 — 당일 원/투룸 태극기 집계.
 * - 타업체에만 넘긴 건은 제외(자사 인원·슬롯과 무관)
 * - count: 미배정 원/투룸(자사 관리 대상만)
 * - show: count > 0
 */
export function shouldShowSkOneRoomTaegeuk(items: readonly ScheduleItem[]): {
  show: boolean;
  count: number;
  highlighted: boolean;
  unassignedOneRoomCount: number;
} {
  const relevant = items.filter(scheduleOneRoomItemForInternalTaegeuk);
  const unassignedOneRoomCount = relevant.filter((it) => !scheduleItemHasAnyAssignment(it)).length;
  if (unassignedOneRoomCount === 0) {
    return { show: false, count: 0, highlighted: false, unassignedOneRoomCount: 0 };
  }
  return {
    show: true,
    count: unassignedOneRoomCount,
    highlighted: true,
    unassignedOneRoomCount,
  };
}
