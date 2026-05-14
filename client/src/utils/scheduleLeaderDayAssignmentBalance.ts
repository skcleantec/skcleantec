import type { ScheduleItem } from '../api/schedule';
import { formatPreferredDateInputYmd } from './dateFormat';

/**
 * 예약일(KST YYYY-MM-DD)별, 팀장 id별로 그날 배정된 접수 건수를 센다.
 * 한 접수에 팀장이 여러 명이면 각 id마다 +1 (동일 접수 내 중복 id면 그만큼 반복 가산).
 */
export function buildLeaderDayAssignmentCounts(
  items: ScheduleItem[]
): Map<string, Map<string, number>> {
  const byDate = new Map<string, Map<string, number>>();
  for (const item of items) {
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
      const id = a.teamLeader?.id?.trim();
      if (!id) continue;
      m.set(id, (m.get(id) ?? 0) + 1);
    }
  }
  return byDate;
}

/** 해당 접수에 배정된 팀장 중, 그날 전체가 1건인 사람이 있으면 true (미배정 접수는 false). */
export function scheduleItemHasLeaderWithSingleAssignmentOnDay(
  item: ScheduleItem,
  countsForDate: Map<string, number> | undefined
): boolean {
  if (!countsForDate || !item.assignments?.length) return false;
  for (const a of item.assignments) {
    const id = a.teamLeader?.id?.trim();
    if (!id) continue;
    if (countsForDate.get(id) === 1) return true;
  }
  return false;
}
