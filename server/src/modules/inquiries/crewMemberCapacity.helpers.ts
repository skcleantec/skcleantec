import type { Prisma, PrismaClient } from '@prisma/client';
import { parseYmdToDate } from '../team-crew-groups/crewGroupDayRoster.service.js';
import { DEFAULT_CREW_UNITS_PER_INQUIRY } from '../schedule/crewCapacity.constants.js';
import { kstYmdKeysInRange } from './inquiryListDateRange.js';
import { dateToYmdKst } from '../users/userEmployment.js';

export { DEFAULT_CREW_UNITS_PER_INQUIRY };

/** 테넌트 소속 활성 팀원 — direct tenant_id + 팀/크루 join (백필 누락·레거시 호환) */
export function tenantActiveTeamMemberWhere(tenantId: string): Prisma.TeamMemberWhereInput {
  return {
    isActive: true,
    OR: [
      { tenantId },
      { team: { tenantId } },
      { crewGroupMembers: { some: { group: { tenantId } } } },
    ],
  };
}

/** 팀장 소속 없는 풀 팀원 — 해당 테넌트 크루 그룹 소속 또는 tenant_id 일치 */
export function poolMemberInTenantWhere(tenantId: string): Prisma.TeamMemberWhereInput {
  return {
    teamId: null,
    isActive: true,
    OR: [{ tenantId }, { crewGroupMembers: { some: { group: { tenantId } } } }],
  };
}

/** 접수 1건이 소모하는 팀원 투입 단위 (미설정/null 기본 0명) */
export function crewUnitsForInquiry(crewMemberCount: number | null): number {
  if (crewMemberCount == null) return 0;
  if (crewMemberCount <= 0) return 0;
  return Math.min(100, crewMemberCount);
}

/** 접수 예약일의 달력 날짜(KST) — PATCH 시 같은 날 재저장 여부 비교용으로 export */
export function preferredDateYmdKst(d: Date | null | undefined): string | null {
  if (d == null) return null;
  return d.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

function ymdKst(d: Date): string {
  return preferredDateYmdKst(d)!;
}

/** 예약일이 속한 하루(KST 경계) — DB preferredDate 조회용 */
function preferredDateDayBounds(ymd: string): { gte: Date; lte: Date } {
  return {
    gte: new Date(`${ymd}T00:00:00.000+09:00`),
    lte: new Date(`${ymd}T23:59:59.999+09:00`),
  };
}

function dateToKstYmdKey(d: Date): string {
  return dateToYmdKst(d);
}

/** 집계 모드(useDailyRosterOnly) 크루 그룹 소속 팀원 — 해당일 명단에 있어야 가용으로 친다 */
async function loadDailyRosterOnlyRestriction(
  prisma: PrismaClient,
  params: { rosterYmd?: string; date?: Date; rangeStart?: Date; rangeEnd?: Date; tenantId: string }
): Promise<{ restrictedIds: Set<string>; rosterByDay: Map<string, Set<string>> }> {
  const groupWhere = { tenantId: params.tenantId, isActive: true, useDailyRosterOnly: true };
  const restrictedRows = await prisma.teamCrewGroupMember.findMany({
    where: {
      group: groupWhere,
    },
    select: { teamMemberId: true },
  });
  const restrictedIds = new Set(restrictedRows.map((r) => r.teamMemberId));
  const rosterByDay = new Map<string, Set<string>>();
  if (restrictedIds.size === 0) {
    return { restrictedIds, rosterByDay };
  }

  /** 명단 저장(putDayRoster)과 동일한 일자 앵커 — 단일 YMD가 있으면 그걸 우선 */
  const dateFilter =
    params.rosterYmd != null
      ? parseYmdToDate(params.rosterYmd)
      : params.date != null
        ? params.date
        : { gte: params.rangeStart!, lte: params.rangeEnd! };

  const rosterRows = await prisma.teamCrewGroupDayRoster.findMany({
    where: {
      date: dateFilter,
      group: groupWhere,
    },
    select: { teamMemberId: true, date: true },
  });
  for (const row of rosterRows) {
    const key = dateToKstYmdKey(row.date);
    if (!rosterByDay.has(key)) rosterByDay.set(key, new Set());
    rosterByDay.get(key)!.add(row.teamMemberId);
  }
  return { restrictedIds, rosterByDay };
}

/**
 * 스케줄 통계 등: 기간 내 날짜별 가용 팀원 수.
 * `countAvailableFieldStaffOnDate`를 날마다 호출하면 N일 × 2회 DB — 일괄 조회로 치환.
 */
export async function countAvailableFieldStaffByDateRange(
  prisma: PrismaClient,
  rangeStart: Date,
  rangeEnd: Date,
  tenantId: string
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  const startYmd = dateToKstYmdKey(rangeStart);
  const endYmd = dateToKstYmdKey(rangeEnd);
  const dayKeys = kstYmdKeysInRange(startYmd, endYmd);
  const members = await prisma.teamMember.findMany({
    where: tenantActiveTeamMemberWhere(tenantId),
    select: { id: true },
  });
  if (members.length === 0) {
    for (const key of dayKeys) {
      result.set(key, 0);
    }
    return result;
  }

  const memberIdSet = new Set(members.map((m) => m.id));

  const [{ restrictedIds, rosterByDay }, dayOffRows, slotRows] = await Promise.all([
    loadDailyRosterOnlyRestriction(prisma, { rangeStart, rangeEnd, tenantId }),
    prisma.teamMemberDayOff.findMany({
      where: {
        date: { gte: rangeStart, lte: rangeEnd },
        teamMemberId: { in: [...memberIdSet] },
      },
      select: { teamMemberId: true, date: true },
    }),
    prisma.scheduleDayTeamMemberSlot.findMany({
      where: { tenantId, date: { gte: rangeStart, lte: rangeEnd } },
    }),
  ]);

  const offByDay = new Map<string, Set<string>>();
  for (const row of dayOffRows) {
    const key = dateToKstYmdKey(row.date);
    if (!offByDay.has(key)) offByDay.set(key, new Set());
    offByDay.get(key)!.add(row.teamMemberId);
  }

  const slotByDay = new Map<string, Map<string, boolean>>();
  for (const row of slotRows) {
    if (!memberIdSet.has(row.teamMemberId)) continue;
    const key = dateToKstYmdKey(row.date);
    if (!slotByDay.has(key)) slotByDay.set(key, new Map());
    slotByDay.get(key)!.set(row.teamMemberId, row.available);
  }

  for (const key of dayKeys) {
    const offSet = offByDay.get(key) ?? new Set<string>();
    const slotMap = slotByDay.get(key) ?? new Map<string, boolean>();
    const rosterForDay = rosterByDay.get(key) ?? new Set<string>();
    let n = 0;
    for (const m of members) {
      if (restrictedIds.has(m.id) && !rosterForDay.has(m.id)) {
        continue;
      }
      if (slotMap.has(m.id)) {
        if (slotMap.get(m.id)) n++;
      } else if (!offSet.has(m.id)) {
        n++;
      }
    }
    result.set(key, n);
  }
  return result;
}

/**
 * 휴무·슬롯·일자 명단(집계 모드)까지 반영한 당일 「가용」 활성 팀원 id 집합.
 * 접수 팀원 드롭다운·용량 집계와 동일 기준.
 */
export async function getAvailableFieldStaffMemberIdsOnDate(
  prisma: PrismaClient,
  ymd: string,
  tenantId: string
): Promise<Set<string>> {
  const dateOnly = new Date(`${ymd}T12:00:00+09:00`);
  const [members, overrides, { restrictedIds, rosterByDay }] = await Promise.all([
    prisma.teamMember.findMany({
      where: tenantActiveTeamMemberWhere(tenantId),
      select: {
        id: true,
        dayOffs: { where: { date: dateOnly }, select: { id: true } },
      },
    }),
    prisma.scheduleDayTeamMemberSlot.findMany({
      where: { tenantId, date: dateOnly },
    }),
    loadDailyRosterOnlyRestriction(prisma, { rosterYmd: ymd, tenantId }),
  ]);
  const rosterForDay = new Set<string>();
  for (const ids of rosterByDay.values()) {
    for (const id of ids) rosterForDay.add(id);
  }
  const oMap = new Map(overrides.map((o) => [o.teamMemberId, o.available]));
  const out = new Set<string>();
  for (const m of members) {
    if (restrictedIds.has(m.id) && !rosterForDay.has(m.id)) {
      continue;
    }
    if (oMap.has(m.id)) {
      if (oMap.get(m.id)) out.add(m.id);
    } else if (m.dayOffs.length === 0) {
      out.add(m.id);
    }
  }
  return out;
}

/** 팀원 휴무 + 일자별 관리자 수동 가용(ScheduleDayTeamMemberSlot) 병합 후 당일 투입 가능 인원 */
export async function countAvailableFieldStaffOnDate(
  prisma: PrismaClient,
  ymd: string,
  tenantId: string
): Promise<number> {
  const ids = await getAvailableFieldStaffMemberIdsOnDate(prisma, ymd, tenantId);
  return ids.size;
}

/** 배정이 전부 타업체(EXTERNAL_PARTNER)면 자사 팀원 용량에서 제외 */
async function inquiryUsesInternalCrew(
  prisma: PrismaClient | { inquiry: PrismaClient['inquiry']; user: PrismaClient['user'] },
  inquiryId: string
): Promise<boolean> {
  const asg = await prisma.inquiry.findUnique({
    where: { id: inquiryId },
    select: {
      assignments: { select: { teamLeader: { select: { role: true } } } },
    },
  });
  const assigns = asg?.assignments ?? [];
  if (assigns.length === 0) return true;
  return assigns.some((a) => a.teamLeader.role === 'TEAM_LEADER');
}

/** 해당일 예약(취소 제외) 투입 인원 합 — 타업체 전배 건은 제외 */
export async function sumCrewDemandForPreferredDate(
  prisma: PrismaClient | { inquiry: PrismaClient['inquiry'] },
  ymd: string,
  excludeInquiryId?: string
): Promise<number> {
  const { gte, lte } = preferredDateDayBounds(ymd);
  const rows = await prisma.inquiry.findMany({
    where: {
      preferredDate: { gte, lte },
      status: { notIn: ['CANCELLED', 'ON_HOLD'] },
      ...(excludeInquiryId ? { id: { not: excludeInquiryId } } : {}),
    },
    select: { id: true, crewMemberCount: true },
  });
  let sum = 0;
  for (const r of rows) {
    if (!(await inquiryUsesInternalCrew(prisma as PrismaClient, r.id))) continue;
    sum += crewUnitsForInquiry(r.crewMemberCount);
  }
  return sum;
}

export async function assertCrewCapacityForInquiry(params: {
  prisma: PrismaClient;
  tenantId: string;
  preferredDate: Date | null;
  crewMemberCount: number | null;
  excludeInquiryId?: string;
  /** 분배 저장 직전: 이 배열로 타업체 전배 여부 판단(DB 미반영 시) */
  assigneeUserIdsPreview?: string[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { prisma, tenantId, preferredDate, crewMemberCount, excludeInquiryId, assigneeUserIdsPreview } = params;
  if (!preferredDate) return { ok: true };

  const ymd = ymdKst(preferredDate);
  const activeStaff = await prisma.teamMember.count({ where: tenantActiveTeamMemberWhere(tenantId) });
  if (activeStaff === 0) return { ok: true };

  const available = await countAvailableFieldStaffOnDate(prisma, ymd, tenantId);
  const demandExcluding = await sumCrewDemandForPreferredDate(prisma, ymd, excludeInquiryId);

  let previewUsesInternalCrew = true;
  if (assigneeUserIdsPreview !== undefined) {
    if (assigneeUserIdsPreview.length === 0) {
      previewUsesInternalCrew = true;
    } else {
      const users = await prisma.user.findMany({
        where: { id: { in: assigneeUserIdsPreview } },
        select: { role: true },
      });
      previewUsesInternalCrew = users.some((u) => u.role === 'TEAM_LEADER');
    }
  } else if (excludeInquiryId) {
    previewUsesInternalCrew = await inquiryUsesInternalCrew(prisma, excludeInquiryId);
  }

  const thisUnits = previewUsesInternalCrew ? crewUnitsForInquiry(crewMemberCount) : 0;
  const totalAfter = demandExcluding + thisUnits;

  if (totalAfter > available) {
    const demandOnly = await sumCrewDemandForPreferredDate(prisma, ymd, excludeInquiryId);
    return {
      ok: false,
      error: `해당일(${ymd}) 투입 가능한 팀원은 ${available}명입니다. 기존 접수 투입 합 ${demandOnly}명 + 이번 ${thisUnits}명으로 가용 인원을 초과합니다.`,
    };
  }
  return { ok: true };
}
