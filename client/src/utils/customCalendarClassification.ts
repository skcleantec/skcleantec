import type { UserCustomCalendarItem } from '../api/userCustomCalendars';
import type { ScheduleItem } from '../api/schedule';
import { matchesCustomCalendarFilter } from './customCalendarMatch';

export type CustomCalendarTabRow = 'region' | 'company';

/** 업체만(지역·권역 없음) → company 줄; 그 외(지역·권역·혼합) → region 줄 */
export function customCalendarTabRow(
  cal: Pick<UserCustomCalendarItem, 'regions' | 'externalCompanyIds' | 'serviceZoneId'>,
): CustomCalendarTabRow {
  const hasCompany = cal.externalCompanyIds.length > 0;
  const hasRegion = cal.regions.length > 0 || Boolean(cal.serviceZoneId);
  if (hasCompany && !hasRegion) return 'company';
  return 'region';
}

export function splitCustomCalendarsByTabRow(calendars: readonly UserCustomCalendarItem[]) {
  const regionCalendars: UserCustomCalendarItem[] = [];
  const companyCalendars: UserCustomCalendarItem[] = [];
  for (const cal of calendars) {
    if (customCalendarTabRow(cal) === 'company') companyCalendars.push(cal);
    else regionCalendars.push(cal);
  }
  return { regionCalendars, companyCalendars };
}

export function hasActiveCustomCalendarFilter(
  regionCal: UserCustomCalendarItem | null,
  companyCal: UserCustomCalendarItem | null,
): boolean {
  return Boolean(regionCal || companyCal);
}

/** 지역·업체 캘린더 AND 필터; 둘 다 없으면 isolateFromGlobal 처리 */
export function filterItemsByCustomCalendars(
  items: ScheduleItem[],
  regionCal: UserCustomCalendarItem | null,
  companyCal: UserCustomCalendarItem | null,
  allCalendars: readonly UserCustomCalendarItem[],
): ScheduleItem[] {
  if (regionCal || companyCal) {
    return items.filter((it) => {
      if (regionCal && !matchesCustomCalendarFilter(it, regionCal)) return false;
      if (companyCal && !matchesCustomCalendarFilter(it, companyCal)) return false;
      return true;
    });
  }
  if (allCalendars.length === 0) return items;
  const hiddenByIsolated = new Set<string>();
  for (const cal of allCalendars) {
    if (!cal.isolateFromGlobal) continue;
    for (const it of items) {
      if (matchesCustomCalendarFilter(it, cal)) hiddenByIsolated.add(it.id);
    }
  }
  if (hiddenByIsolated.size === 0) return items;
  return items.filter((it) => !hiddenByIsolated.has(it.id));
}

export function formatCustomCalendarFilterSummary(
  cal: UserCustomCalendarItem,
  externalCompanyNames: ReadonlyMap<string, string>,
): string {
  return (
    [
      ...cal.regions,
      ...cal.externalCompanyIds
        .map((id) => externalCompanyNames.get(id) ?? id)
        .map((name) => `[타업체] ${name}`),
    ].join(' · ') || '필터 없음'
  );
}
