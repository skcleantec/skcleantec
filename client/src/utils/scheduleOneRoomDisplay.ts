import type { ScheduleItem } from '../api/schedule';
import { detectOneRoomFromNotes } from './orderFormOneRoom';

/** 스케줄 캘린더 — 당일 접수가 원/투룸(`isOneRoom`)인지 (레거시 특이사항 문구 포함) */
export function scheduleItemIsOneRoom(
  item: Pick<ScheduleItem, 'isOneRoom' | 'specialNotes'> & {
    orderForm?: { customerSpecialNotes?: string | null } | null;
  },
): boolean {
  if (Boolean(item.isOneRoom)) return true;
  const notes =
    item.orderForm?.customerSpecialNotes?.trim() ||
    item.specialNotes?.trim() ||
    '';
  return detectOneRoomFromNotes(notes);
}

export function countScheduleOneRoomItems(items: readonly ScheduleItem[]): number {
  return items.filter(scheduleItemIsOneRoom).length;
}

/** 원/투룸 접수가 1건 이상이고, 아직 팀장·타업체 미배정인 건이 있을 때만 태극기 표시 */
export function shouldShowSkOneRoomTaegeuk(items: readonly ScheduleItem[]): {
  show: boolean;
  count: number;
} {
  const oneRoomItems = items.filter(scheduleItemIsOneRoom);
  const count = oneRoomItems.length;
  if (count === 0) return { show: false, count: 0 };
  const hasUnassignedOneRoom = oneRoomItems.some((it) => !it.assignments?.[0]);
  return { show: hasUnassignedOneRoom, count };
}
