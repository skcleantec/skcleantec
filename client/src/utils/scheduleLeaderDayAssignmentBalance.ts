import type { ScheduleItem } from '../api/schedule';
import { formatPreferredDateInputYmd } from './dateFormat';
import { getScheduleTimeBucket } from './scheduleTimeBucket';

function isInternalScheduleLeader(role: string | null | undefined): boolean {
  return role === 'TEAM_LEADER' || role === 'ADMIN';
}

function isActiveScheduleListItem(item: ScheduleItem): boolean {
  return item.status !== 'CANCELLED' && item.status !== 'ON_HOLD';
}

function incrementLeaderCountsForItem(
  counts: Map<string, number>,
  item: ScheduleItem,
): void {
  const asg = item.assignments;
  if (!asg?.length) return;
  for (const a of asg) {
    if (!isInternalScheduleLeader(a.teamLeader?.role)) continue;
    const id = a.teamLeader?.id?.trim();
    if (!id) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
}

function addAssignmentCountsForItems(
  items: ScheduleItem[],
  bucketFilter: 'morning' | 'afternoon',
): Map<string, Map<string, number>> {
  const byDate = new Map<string, Map<string, number>>();
  for (const item of items) {
    if (!isActiveScheduleListItem(item)) continue;
    if (getScheduleTimeBucket(item) !== bucketFilter) continue;
    const ymd = item.preferredDate ? formatPreferredDateInputYmd(item.preferredDate) : '';
    if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) continue;
    let m = byDate.get(ymd);
    if (!m) {
      m = new Map();
      byDate.set(ymd, m);
    }
    incrementLeaderCountsForItem(m, item);
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
  const byDate = new Map<string, Map<string, number>>();
  for (const item of items) {
    if (!isActiveScheduleListItem(item)) continue;
    const ymd = item.preferredDate ? formatPreferredDateInputYmd(item.preferredDate) : '';
    if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) continue;
    let m = byDate.get(ymd);
    if (!m) {
      m = new Map();
      byDate.set(ymd, m);
    }
    incrementLeaderCountsForItem(m, item);
  }
  return byDate;
}

/** 오전 슬롯(목록과 동일 bucket) — 팀장별 예약일당 오전 배정 건수 */
export function buildLeaderMorningAssignmentCounts(
  items: ScheduleItem[],
): Map<string, Map<string, number>> {
  return addAssignmentCountsForItems(items, 'morning');
}

/** 오후 슬롯(목록과 동일 bucket) — 팀장별 예약일당 오후 배정 건수 */
export function buildLeaderAfternoonAssignmentCounts(
  items: ScheduleItem[],
): Map<string, Map<string, number>> {
  return addAssignmentCountsForItems(items, 'afternoon');
}

/** 같은 날짜 접수 목록만으로 슬롯별 팀장 배정 건수(일별 리스트·상세 모달용) */
export function buildLeaderSlotAssignmentCountMapsForDayItems(
  dayItems: readonly ScheduleItem[],
): { morning: Map<string, number>; afternoon: Map<string, number> } {
  const morning = new Map<string, number>();
  const afternoon = new Map<string, number>();
  for (const item of dayItems) {
    if (!isActiveScheduleListItem(item)) continue;
    const bucket = getScheduleTimeBucket(item);
    if (bucket === 'morning') incrementLeaderCountsForItem(morning, item);
    else if (bucket === 'afternoon') incrementLeaderCountsForItem(afternoon, item);
  }
  return { morning, afternoon };
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
