import type { UserCustomCalendarItem } from '../api/userCustomCalendars';
import type { ScheduleItem } from '../api/schedule';
import { matchesCustomCalendarFilter } from './customCalendarMatch';
import { allKoreanSidoRegionValues, isAllKoreanRegionsSelected } from '../constants/koreanCities';

export type CustomCalendarTabRow = 'region' | 'company';

type CalendarShape = Pick<UserCustomCalendarItem, 'regions' | 'externalCompanyIds' | 'serviceZoneId'>;

/** 순수 지역(타업체 없음) — 지역 탭 줄 */
export function isPureRegionCalendar(cal: CalendarShape): boolean {
  const hasRegion = cal.regions.length > 0 || Boolean(cal.serviceZoneId);
  return hasRegion && cal.externalCompanyIds.length === 0;
}

/** 타업체 포함(혼합 포함) — 업체 탭 줄 */
export function isCompanyTabCalendar(cal: CalendarShape): boolean {
  return cal.externalCompanyIds.length > 0;
}

/** URL·레거시 마이그레이션용 — 업체 우선, 없으면 순수 지역 */
export function customCalendarTabRow(cal: CalendarShape): CustomCalendarTabRow | null {
  if (isCompanyTabCalendar(cal)) return 'company';
  if (isPureRegionCalendar(cal)) return 'region';
  return null;
}

export function splitCustomCalendarsByTabRow(calendars: readonly UserCustomCalendarItem[]) {
  const regionCalendars: UserCustomCalendarItem[] = [];
  const companyCalendars: UserCustomCalendarItem[] = [];
  for (const cal of calendars) {
    if (isPureRegionCalendar(cal)) regionCalendars.push(cal);
    if (isCompanyTabCalendar(cal)) companyCalendars.push(cal);
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

/** 탭 tooltip — 지역 */
export function formatRegionTabHint(regions: readonly string[]): string {
  if (regions.length === 0) return '지역 미설정';
  if (isAllKoreanRegionsSelected(regions)) return '전국 시·도';
  if (regions.length === 1) return regions[0]!;
  return `${regions[0]} 외 ${regions.length - 1}곳`;
}

/** 탭 tooltip — 타업체 */
export function formatCompanyTabHint(
  externalCompanyIds: readonly string[],
  externalCompanyNames: ReadonlyMap<string, string>,
): string {
  if (externalCompanyIds.length === 0) return '타업체 미설정';
  const names = externalCompanyIds.map((id) => externalCompanyNames.get(id) ?? id);
  if (names.length === 1) return names[0]!;
  return `${names[0]} 외 ${names.length - 1}곳`;
}

/** 모달 등 상세 표시용 (스케줄 본문에는 쓰지 않음) */
export function formatCustomCalendarFilterSummary(
  cal: UserCustomCalendarItem,
  externalCompanyNames: ReadonlyMap<string, string>,
): string {
  const parts: string[] = [];
  if (cal.regions.length > 0) {
    parts.push(
      isAllKoreanRegionsSelected(cal.regions)
        ? '전국 시·도'
        : cal.regions.join(' · '),
    );
  }
  if (cal.externalCompanyIds.length > 0) {
    parts.push(
      ...cal.externalCompanyIds
        .map((id) => externalCompanyNames.get(id) ?? id)
        .map((name) => `[타업체] ${name}`),
    );
  }
  return parts.join(' · ') || '필터 없음';
}

/** 전국 선택 여부 (hint 보조) */
export { allKoreanSidoRegionValues };
