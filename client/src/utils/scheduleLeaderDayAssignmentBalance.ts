import type { ScheduleItem } from '../api/schedule';
import { formatPreferredDateInputYmd } from './dateFormat';
import { consumesAfternoonSlot, consumesMorningSlot } from './scheduleSlotOccupancy';
import { getScheduleTimeBucket } from './scheduleTimeBucket';

function isInternalScheduleLeader(role: string | null | undefined): boolean {
  return role === 'TEAM_LEADER' || role === 'ADMIN';
}

function addAssignmentCountsForItems(
  items: ScheduleItem[],
  shouldCountItem: (item: ScheduleItem) => boolean,
): Map<string, Map<string, number>> {
  const byDate = new Map<string, Map<string, number>>();
  for (const item of items) {
    if (!shouldCountItem(item)) continue;
    const ymd = item.preferredDate ? formatPreferredDateInputYmd(item.preferredDate) : '';
    if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) continue;
    const asg = item.assignments;
    if (!asg?.length) continue;
    let m = byDate.get(ymd);
    if (!m) {
      m = new Map();
      byDate.set(ymd, m);
    }
    for (const a of asg) {
      if (!isInternalScheduleLeader(a.teamLeader?.role)) continue;
      const id = a.teamLeader?.id?.trim();
      if (!id) continue;
      m.set(id, (m.get(id) ?? 0) + 1);
    }
  }
  return byDate;
}

/**
 * 예약일(KST YYYY-MM-DD)별, 팀장 id별로 그날 배정된 접수 건수를 센다.
 * 한 접수에 팀장이 여러 명이면 각 id마다 +1 (동일 접수 내 중복 id면 그만큼 반복 가산).
 */
export function buildLeaderDayAssignmentCounts(
  items: ScheduleItem[],
): Map<string, Map<string, number>> {
  return addAssignmentCountsForItems(items, () => true);
}

/** 오전 슬롯(일반 오전 + 사이→오전 확정) 접수만 — 팀장별 당일 오전 배정 건수 */
export function buildLeaderMorningAssignmentCounts(
  items: ScheduleItem[],
): Map<string, Map<string, number>> {
  return addAssignmentCountsForItems(items, (item) => consumesMorningSlot(item));
}

/** 오후 슬롯(일반 오후 + 사이→오후 확정) 접수만 — 팀장별 당일 오후 배정 건수 */
export function buildLeaderAfternoonAssignmentCounts(
  items: ScheduleItem[],
): Map<string, Map<string, number>> {
  return addAssignmentCountsForItems(items, (item) => consumesAfternoonSlot(item));
}

/**
 * 해당 슬롯(오전/오후) 일정 — 배정된 자사 팀장 중 그날 **이 슬롯만** 1건·반대 슬롯 0건이면 true.
 * 오전·오후 모두 1건인 팀장은 슬롯별 기본 색(amber/sky) 유지.
 */
export function scheduleItemHasLeaderWithSingleSlotAssignmentOnDay(
  item: ScheduleItem,
  morningCountsForDate: Map<string, number> | undefined,
  afternoonCountsForDate?: Map<string, number> | undefined,
): boolean {
  if (!item.assignments?.length) return false;
  const bucket = getScheduleTimeBucket(item);
  if (bucket !== 'morning' && bucket !== 'afternoon') return false;
  for (const a of item.assignments) {
    if (!isInternalScheduleLeader(a.teamLeader?.role)) continue;
    const id = a.teamLeader?.id?.trim();
    if (!id) continue;
    const morningN = morningCountsForDate?.get(id) ?? 0;
    const afternoonN = afternoonCountsForDate?.get(id) ?? 0;
    if (bucket === 'morning' && morningN === 1 && afternoonN === 0) return true;
    if (bucket === 'afternoon' && afternoonN === 1 && morningN === 0) return true;
  }
  return false;
}

/** @deprecated `scheduleItemHasLeaderWithSingleSlotAssignmentOnDay` 사용 */
export function scheduleItemHasLeaderWithSingleMorningAssignmentOnDay(
  item: ScheduleItem,
  morningCountsForDate: Map<string, number> | undefined,
  afternoonCountsForDate?: Map<string, number> | undefined,
): boolean {
  return scheduleItemHasLeaderWithSingleSlotAssignmentOnDay(
    item,
    morningCountsForDate,
    afternoonCountsForDate,
  );
}

/** @deprecated 오전 1건 기준으로 `scheduleItemHasLeaderWithSingleMorningAssignmentOnDay` 사용 */
export function scheduleItemHasLeaderWithSingleAssignmentOnDay(
  item: ScheduleItem,
  countsForDate: Map<string, number> | undefined,
): boolean {
  return scheduleItemHasLeaderWithSingleMorningAssignmentOnDay(item, countsForDate);
}
