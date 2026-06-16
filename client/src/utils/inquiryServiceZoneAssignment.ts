import type { ServiceZoneItem, UserServiceZoneSummary } from '../api/serviceZones';
import type { UserCustomCalendarItem } from '../api/userCustomCalendars';
import { addressMatchesRegions } from './regionMatch';

export type TeamLeaderAssignmentSurface = 'global-schedule' | 'regional-schedule' | 'inquiry-list';

export function matchingServiceZonesForAddress(
  address: string | null | undefined,
  zones: readonly Pick<ServiceZoneItem, 'id' | 'name' | 'regions' | 'isActive'>[],
): Array<{ id: string; name: string }> {
  return zones
    .filter((z) => z.isActive !== false && addressMatchesRegions(address, z.regions))
    .map((z) => ({ id: z.id, name: z.name }));
}

export function pinnedServiceZoneIdForInquiry(
  inquiryId: string | undefined,
  calendars: readonly Pick<UserCustomCalendarItem, 'serviceZoneId' | 'pinnedInquiryIds'>[],
): string | null {
  if (!inquiryId?.trim()) return null;
  for (const cal of calendars) {
    const zid = cal.serviceZoneId?.trim();
    if (!zid) continue;
    if (Array.isArray(cal.pinnedInquiryIds) && cal.pinnedInquiryIds.includes(inquiryId)) {
      return zid;
    }
  }
  return null;
}

export function resolveEffectiveAssignmentServiceZoneId(params: {
  activeServiceZoneId?: string | null;
  manualAssignmentZoneId?: string | null;
  pinnedServiceZoneId?: string | null;
}): string {
  return (
    params.activeServiceZoneId?.trim() ||
    params.pinnedServiceZoneId?.trim() ||
    params.manualAssignmentZoneId?.trim() ||
    ''
  );
}

/** 캘린더 pin 권역이 주소 자동 매칭 권역과 다른 근접·수동 배정 */
export function isNearbyAssignmentViaPin(params: {
  pinnedServiceZoneId: string | null;
  matchingZones: Array<{ id: string; name: string }>;
}): boolean {
  const pin = params.pinnedServiceZoneId?.trim();
  if (!pin) return false;
  if (params.matchingZones.length === 0) return true;
  return !params.matchingZones.some((z) => z.id === pin);
}

export function teamLeaderAssignmentBlocked(params: {
  surface: TeamLeaderAssignmentSurface;
  matchingZones: Array<{ id: string; name: string }>;
  pinnedServiceZoneId: string | null;
  effectiveAssignmentZoneId: string;
}): { blocked: boolean; message?: string } {
  const pinned = params.pinnedServiceZoneId?.trim() ?? '';
  const effective = params.effectiveAssignmentZoneId?.trim() ?? '';

  if (params.surface === 'global-schedule') {
    if (pinned) return { blocked: false };
    if (params.matchingZones.length > 0) {
      const names = params.matchingZones.map((z) => z.name).join(', ');
      return {
        blocked: true,
        message: names
          ? `${names} 권역 접수입니다. 근접 권역 팀장 배정이 필요하면 상세에서 「내 추가 캘린더」에 권역 캘린더를 지정한 뒤 팀장을 배정해 주세요.`
          : '이 접수는 서비스 권역이 지정되어 있습니다. 해당 지역 캘린더 탭에서 팀장을 배정해 주세요.',
      };
    }
    return { blocked: false };
  }

  if (params.surface === 'inquiry-list') {
    if (effective) return { blocked: false };
    if (params.matchingZones.length > 0) {
      const names = params.matchingZones.map((z) => z.name).join(', ');
      return {
        blocked: true,
        message: names
          ? `${names} 권역 접수입니다. 아래 「배정 권역」을 선택하거나, 「내 추가 캘린더」에서 권역 캘린더를 지정해 주세요.`
          : '배정 권역을 선택하거나 권역 캘린더를 지정한 뒤 팀장을 지정해 주세요.',
      };
    }
    return { blocked: false };
  }

  return { blocked: false };
}

export function formatUserServiceZoneLabel(zones: UserServiceZoneSummary[] | undefined): string {
  if (!zones?.length) return '—';
  return zones.map((z) => z.name).join(', ');
}
