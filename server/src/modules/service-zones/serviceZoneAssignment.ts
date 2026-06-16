import type { PrismaClient } from '@prisma/client';
import { addressMatchesRegions } from '../../lib/regionMatch.js';
import { ServiceZoneValidationError } from './serviceZone.service.js';
import { parseServiceZoneRegionsJson } from './serviceZoneRegions.js';
import { assertTeamLeadersBelongToServiceZone } from './userServiceZone.service.js';

export type ActiveServiceZoneRow = {
  id: string;
  name: string;
  regions: unknown;
  sortOrder: number;
  isActive: boolean;
};

export async function listActiveServiceZoneRows(
  db: PrismaClient,
  tenantId: string,
): Promise<ActiveServiceZoneRow[]> {
  return db.serviceZone.findMany({
    where: { tenantId, isActive: true },
    select: { id: true, name: true, regions: true, sortOrder: true, isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
}

export function matchingServiceZonesForAddress(
  address: string | null | undefined,
  zones: ActiveServiceZoneRow[],
): ActiveServiceZoneRow[] {
  return zones.filter((z) => {
    const regions = parseServiceZoneRegionsJson(z.regions);
    return regions.length > 0 && addressMatchesRegions(address, regions);
  });
}

/** 접수에 수동 pin 된 캘린더 중 serviceZoneId (활성 권역만) */
export async function pinnedServiceZoneIdsForInquiry(
  db: PrismaClient,
  tenantId: string,
  inquiryId: string,
): Promise<string[]> {
  const pins = await db.userCustomCalendarInquiryPin.findMany({
    where: { tenantId, inquiryId },
    select: {
      calendar: { select: { serviceZoneId: true } },
    },
  });
  const ids = new Set<string>();
  for (const p of pins) {
    const zid = p.calendar.serviceZoneId?.trim();
    if (zid) ids.add(zid);
  }
  if (ids.size === 0) return [];
  const active = await db.serviceZone.findMany({
    where: { tenantId, id: { in: [...ids] }, isActive: true },
    select: { id: true },
  });
  return active.map((z) => z.id);
}

export type TeamLeaderAssignmentZoneContext = {
  /** 주소·pin 기준 배정에 필요한 권역 id 목록 (없으면 전체 배정 가능) */
  requiredZoneIds: string[];
  /** pin 으로 고정된 권역 (있으면 우선) */
  pinnedZoneIds: string[];
  matchingZones: Array<{ id: string; name: string }>;
};

export async function resolveTeamLeaderAssignmentZoneContext(
  db: PrismaClient,
  tenantId: string,
  inquiryAddress: string | null | undefined,
  inquiryId?: string,
): Promise<TeamLeaderAssignmentZoneContext> {
  const zones = await listActiveServiceZoneRows(db, tenantId);
  const matching = matchingServiceZonesForAddress(inquiryAddress, zones);
  const pinnedZoneIds =
    inquiryId != null ? await pinnedServiceZoneIdsForInquiry(db, tenantId, inquiryId) : [];

  const requiredSet = new Set<string>();
  for (const z of matching) requiredSet.add(z.id);
  for (const zid of pinnedZoneIds) requiredSet.add(zid);

  return {
    requiredZoneIds: [...requiredSet],
    pinnedZoneIds,
    matchingZones: matching.map((z) => ({ id: z.id, name: z.name })),
  };
}

export class ServiceZoneAssignmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServiceZoneAssignmentError';
  }
}

/**
 * 팀장 배정 시 권역 규칙 검증.
 * - 권역 매칭 접수: assignmentServiceZoneId 필수, 해당 권역 팀장만
 * - 미매칭 접수: assignmentServiceZoneId 없어도 됨
 */
export async function assertInquiryTeamLeaderAssignmentZones(params: {
  db: PrismaClient;
  tenantId: string;
  inquiryAddress: string | null | undefined;
  inquiryId?: string;
  teamLeaderIds: string[];
  /** INTERNAL_TEAM_LEADER role ids only (EXTERNAL_PARTNER 제외) */
  internalTeamLeaderIds: string[];
  assignmentServiceZoneId?: string | null;
}): Promise<void> {
  const { db, tenantId, inquiryAddress, inquiryId, teamLeaderIds, internalTeamLeaderIds } = params;
  if (teamLeaderIds.length === 0) return;

  const ctx = await resolveTeamLeaderAssignmentZoneContext(db, tenantId, inquiryAddress, inquiryId);
  if (ctx.requiredZoneIds.length === 0) {
    if (params.assignmentServiceZoneId?.trim()) {
      await assertTeamLeadersBelongToServiceZone(
        db,
        tenantId,
        params.assignmentServiceZoneId.trim(),
        internalTeamLeaderIds,
      );
    }
    return;
  }

  const zoneId = params.assignmentServiceZoneId?.trim() ?? '';
  if (!zoneId) {
    const names = ctx.matchingZones.map((z) => z.name).join(', ');
    throw new ServiceZoneAssignmentError(
      names
        ? `이 접수는 ${names} 권역입니다. 해당 지역 캘린더에서 팀장을 배정해 주세요.`
        : '이 접수는 서비스 권역이 지정되어 있습니다. 해당 지역 캘린더에서 팀장을 배정해 주세요.',
    );
  }

  if (!ctx.requiredZoneIds.includes(zoneId)) {
    throw new ServiceZoneAssignmentError('선택한 권역이 이 접수 주소·캘린더 고정과 맞지 않습니다.');
  }

  const zoneRow = await db.serviceZone.findFirst({
    where: { id: zoneId, tenantId, isActive: true },
    select: { name: true },
  });
  if (!zoneRow) {
    throw new ServiceZoneAssignmentError('유효하지 않은 서비스 권역입니다.');
  }

  if (internalTeamLeaderIds.length > 0) {
    await assertTeamLeadersBelongToServiceZone(db, tenantId, zoneId, internalTeamLeaderIds);
  }
}
