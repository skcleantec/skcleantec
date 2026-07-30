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

/** 타업체 배정(자사 팀장 없음) */
export function scheduleItemHasExternalAssignment(
  item: Pick<ScheduleItem, 'assignments'>,
): boolean {
  return (item.assignments ?? []).some((a) => a.teamLeader.role === 'EXTERNAL_PARTNER');
}

/** 송신 파트너 연계(활성) */
export function scheduleItemHasActivePartnerShareSource(
  item: Pick<ScheduleItem, 'tenantShare'>,
): boolean {
  return item.tenantShare?.role === 'SOURCE' && item.tenantShare?.syncStatus === 'ACTIVE';
}

export function scheduleItemHasDbMarketplaceListing(
  item: Pick<ScheduleItem, 'dbListing'>,
): boolean {
  return item.dbListing != null;
}

/** 스케줄 목록·캘린더 공통 — 자사 관리 원/투룸(정보공유·파트너·타업체 이관 제외) */
export function scheduleItemCountsAsOwnOneRoomSchedule(
  item: Pick<ScheduleItem, 'isOneRoom' | 'specialNotes' | 'assignments' | 'dbListing' | 'tenantShare'> & {
    orderForm?: {
      customerSpecialNotes?: string | null;
      prefillAnswers?: Record<string, unknown> | null;
    } | null;
  },
): boolean {
  if (!scheduleItemIsOneRoom(item)) return false;
  if (scheduleItemHasDbMarketplaceListing(item)) return false;
  if (scheduleItemHasExternalAssignment(item)) return false;
  if (scheduleItemHasActivePartnerShareSource(item)) return false;
  return true;
}

/** 타업체에만 넘긴 원/투룸 — 자사 인원·태극기 집계에서 제외 */
export function scheduleOneRoomExcludedFromInternalTaegeukCount(
  item: Pick<ScheduleItem, 'assignments'>,
): boolean {
  return scheduleItemHasExternalAssignmentOnly(item);
}

/** @deprecated scheduleItemCountsAsOwnOneRoomSchedule 사용 */
export function scheduleOneRoomItemForInternalTaegeuk(
  item: Pick<ScheduleItem, 'isOneRoom' | 'specialNotes' | 'assignments' | 'dbListing' | 'tenantShare'> & {
    orderForm?: {
      customerSpecialNotes?: string | null;
      prefillAnswers?: Record<string, unknown> | null;
    } | null;
  },
): boolean {
  return scheduleItemCountsAsOwnOneRoomSchedule(item);
}

export function countScheduleOneRoomItems(items: readonly ScheduleItem[]): number {
  return items.filter(scheduleItemIsOneRoom).length;
}

/**
 * SK 스케줄 캘린더 — 당일 원/투룸 태극기 집계.
 * - 정보공유·파트너·타업체 이관 제외(목록 자사 일정과 동일)
 * - count: 자사 **배정** 원/투룸 건수(목록 오전·오후·사이 자사 배정과 맞춤)
 * - unassignedOneRoomCount: 같은 기준 미배정 건수(툴팁·강조용)
 */
export function shouldShowSkOneRoomTaegeuk(items: readonly ScheduleItem[]): {
  show: boolean;
  count: number;
  highlighted: boolean;
  unassignedOneRoomCount: number;
  assignedOneRoomCount: number;
} {
  const ownOneRoom = items.filter(scheduleItemCountsAsOwnOneRoomSchedule);
  const assignedOneRoomCount = ownOneRoom.filter((it) => scheduleItemHasAnyAssignment(it)).length;
  const unassignedOneRoomCount = ownOneRoom.filter((it) => !scheduleItemHasAnyAssignment(it)).length;
  if (assignedOneRoomCount === 0 && unassignedOneRoomCount === 0) {
    return {
      show: false,
      count: 0,
      highlighted: false,
      unassignedOneRoomCount: 0,
      assignedOneRoomCount: 0,
    };
  }
  return {
    show: true,
    count: assignedOneRoomCount > 0 ? assignedOneRoomCount : unassignedOneRoomCount,
    highlighted: unassignedOneRoomCount > 0,
    unassignedOneRoomCount,
    assignedOneRoomCount,
  };
}
