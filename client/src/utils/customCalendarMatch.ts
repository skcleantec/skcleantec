import type { UserCustomCalendarItem } from '../api/userCustomCalendars';
import type { ScheduleItem } from '../api/schedule';
import { addressMatchesRegions } from './regionMatch';
import { scheduleItemExternalCompanyIds } from './scheduleExternalCompany';

export function scheduleItemPartnerTenantIds(item: ScheduleItem): string[] {
  const share = item.tenantShare;
  if (!share || share.syncStatus !== 'ACTIVE') return [];
  const id = share.partnerTenantId?.trim();
  return id ? [id] : [];
}

export function matchesCustomCalendarRegion(
  item: Pick<ScheduleItem, 'address'>,
  cal: Pick<UserCustomCalendarItem, 'regions'>,
): boolean {
  return Array.isArray(cal.regions) && cal.regions.length > 0
    ? addressMatchesRegions(item.address, cal.regions)
    : false;
}

export function matchesCustomCalendarExternalCompany(
  item: ScheduleItem,
  cal: Pick<UserCustomCalendarItem, 'externalCompanyIds'>,
): boolean {
  return Array.isArray(cal.externalCompanyIds) && cal.externalCompanyIds.length > 0
    ? scheduleItemExternalCompanyIds(item).some((id) => cal.externalCompanyIds.includes(id))
    : false;
}

/** ACTIVE 파트너 연계(SOURCE·TARGET) — partnerTenantId 기준 */
export function matchesCustomCalendarPartnerTenant(
  item: ScheduleItem,
  cal: Pick<UserCustomCalendarItem, 'partnerTenantIds'>,
): boolean {
  return Array.isArray(cal.partnerTenantIds) && cal.partnerTenantIds.length > 0
    ? scheduleItemPartnerTenantIds(item).some((id) => cal.partnerTenantIds.includes(id))
    : false;
}

/** 지역·타업체·파트너 자동 매칭(수동 pin 제외) */
export function matchesCustomCalendarAutoFilter(
  item: ScheduleItem,
  cal: Pick<UserCustomCalendarItem, 'regions' | 'externalCompanyIds' | 'partnerTenantIds'>,
): boolean {
  return (
    matchesCustomCalendarRegion(item, cal) ||
    matchesCustomCalendarExternalCompany(item, cal) ||
    matchesCustomCalendarPartnerTenant(item, cal)
  );
}

export function matchesCustomCalendarFilter(
  item: ScheduleItem,
  cal: Pick<
    UserCustomCalendarItem,
    'regions' | 'externalCompanyIds' | 'partnerTenantIds' | 'pinnedInquiryIds'
  >,
): boolean {
  if (Array.isArray(cal.pinnedInquiryIds) && cal.pinnedInquiryIds.includes(item.id)) {
    return true;
  }
  return matchesCustomCalendarAutoFilter(item, cal);
}

export function isInquiryManuallyPinnedToCalendar(
  inquiryId: string,
  cal: Pick<UserCustomCalendarItem, 'pinnedInquiryIds'>,
): boolean {
  return Array.isArray(cal.pinnedInquiryIds) && cal.pinnedInquiryIds.includes(inquiryId);
}
