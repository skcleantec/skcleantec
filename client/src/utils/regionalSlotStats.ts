import type { ScheduleStatsByDate } from '../api/dayoffs';
import type { ScheduleItem } from '../api/schedule';
import type { UserCustomCalendarItem } from '../api/userCustomCalendars';
import { matchesCustomCalendarFilter } from './customCalendarMatch';
import { consumesAfternoonSlot, consumesMorningSlot, inquiryCountsForInternalToSlot } from './scheduleSlotOccupancy';

export type RegionalDaySlotStats = {
  assignableMorning: number;
  assignableAfternoonSlot: number;
  morningOccupied: number;
  afternoonOccupied: number;
};

function inquiryUsesInternalTeamLeaderSlot(item: ScheduleItem): boolean {
  return inquiryCountsForInternalToSlot(item);
}

function internalLeaderCount(item: ScheduleItem): number {
  const n = (item.assignments ?? []).filter((a) => a.teamLeader.role === 'TEAM_LEADER').length;
  return n > 0 ? n : 1;
}

function collectAssignedLeaderIds(
  items: ScheduleItem[],
  slot: 'morning' | 'afternoon',
): Set<string> {
  const ids = new Set<string>();
  for (const inv of items) {
    const consumes = slot === 'morning' ? consumesMorningSlot(inv) : consumesAfternoonSlot(inv);
    if (!consumes || !inquiryUsesInternalTeamLeaderSlot(inv)) continue;
    for (const a of inv.assignments ?? []) {
      if (a.teamLeader.role !== 'TEAM_LEADER' && a.teamLeader.role !== 'ADMIN') continue;
      ids.add(a.teamLeader.id);
    }
  }
  return ids;
}

function countRegionalWorkingLeaders(
  zoneLeaderIds: Set<string>,
  assignedIds: Set<string>,
  availableIds: string[] | undefined,
): number {
  const working = new Set<string>();
  for (const id of availableIds ?? []) {
    if (zoneLeaderIds.has(id)) working.add(id);
  }
  for (const id of assignedIds) {
    if (zoneLeaderIds.has(id)) working.add(id);
  }
  return working.size;
}

function sumRegionalOccupied(
  items: ScheduleItem[],
  calendar: Pick<UserCustomCalendarItem, 'regions' | 'externalCompanyIds' | 'partnerTenantIds' | 'pinnedInquiryIds'>,
): { morning: number; afternoon: number } {
  let morning = 0;
  let afternoon = 0;
  for (const inv of items) {
    if (!matchesCustomCalendarFilter(inv, calendar)) continue;
    if (!inquiryUsesInternalTeamLeaderSlot(inv)) continue;
    const weight = internalLeaderCount(inv);
    if (consumesMorningSlot(inv)) morning += weight;
    if (consumesAfternoonSlot(inv)) afternoon += weight;
  }
  return { morning, afternoon };
}

function applyClosure(
  stats: RegionalDaySlotStats,
  dayStats: ScheduleStatsByDate | undefined,
): RegionalDaySlotStats {
  const scope = dayStats?.closureScope;
  if (scope === 'FULL' || (dayStats?.manualClosed && !scope)) {
    return { ...stats, assignableMorning: 0, assignableAfternoonSlot: 0 };
  }
  if (scope === 'MORNING') {
    return { ...stats, assignableMorning: 0 };
  }
  if (scope === 'AFTERNOON') {
    return { ...stats, assignableAfternoonSlot: 0 };
  }
  return stats;
}

/** 지역 캘린더(권역 연결) 탭 — 해당 권역 팀장·접수 기준 오전/오후 잔여 TO */
export function computeRegionalDaySlotStats(
  dayItems: ScheduleItem[],
  dayStats: ScheduleStatsByDate | undefined,
  zoneLeaderIds: Set<string>,
  calendar: Pick<UserCustomCalendarItem, 'regions' | 'externalCompanyIds' | 'partnerTenantIds' | 'pinnedInquiryIds'>,
): RegionalDaySlotStats | null {
  if (zoneLeaderIds.size === 0) return null;

  const morningAssigned = collectAssignedLeaderIds(dayItems, 'morning');
  const afternoonAssigned = collectAssignedLeaderIds(dayItems, 'afternoon');
  const morningWorking = countRegionalWorkingLeaders(
    zoneLeaderIds,
    morningAssigned,
    dayStats?.availableMorningLeaderIds,
  );
  const afternoonWorking = countRegionalWorkingLeaders(
    zoneLeaderIds,
    afternoonAssigned,
    dayStats?.availableAfternoonLeaderIds,
  );
  const occupied = sumRegionalOccupied(dayItems, calendar);

  const base: RegionalDaySlotStats = {
    morningOccupied: occupied.morning,
    afternoonOccupied: occupied.afternoon,
    assignableMorning: morningWorking - occupied.morning,
    assignableAfternoonSlot: afternoonWorking - occupied.afternoon,
  };

  return applyClosure(base, dayStats);
}
