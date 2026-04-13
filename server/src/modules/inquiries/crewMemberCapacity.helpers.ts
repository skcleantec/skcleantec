import type { PrismaClient } from '@prisma/client';
import { DEFAULT_CREW_UNITS_PER_INQUIRY } from '../schedule/crewCapacity.constants.js';

export { DEFAULT_CREW_UNITS_PER_INQUIRY };

/** 접수 1건이 소모하는 팀원 투입 단위 (null이면 표준 2명) */
export function crewUnitsForInquiry(crewMemberCount: number | null): number {
  if (crewMemberCount == null) return DEFAULT_CREW_UNITS_PER_INQUIRY;
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

function toDateKeyLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 스케줄 통계 등: 기간 내 날짜별 가용 팀원 수.
 * `countAvailableFieldStaffOnDate`를 날마다 호출하면 N일 × 2회 DB — 일괄 조회로 치환.
 */
export async function countAvailableFieldStaffByDateRange(
  prisma: PrismaClient,
  rangeStart: Date,
  rangeEnd: Date
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  const members = await prisma.teamMember.findMany({
    where: { isActive: true },
    select: { id: true },
  });
  const memberIdSet = new Set(members.map((m) => m.id));
  if (members.length === 0) {
    for (let d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
      result.set(toDateKeyLocal(d), 0);
    }
    return result;
  }

  const [dayOffRows, slotRows] = await Promise.all([
    prisma.teamMemberDayOff.findMany({
      where: {
        date: { gte: rangeStart, lte: rangeEnd },
        teamMemberId: { in: [...memberIdSet] },
      },
      select: { teamMemberId: true, date: true },
    }),
    prisma.scheduleDayTeamMemberSlot.findMany({
      where: { date: { gte: rangeStart, lte: rangeEnd } },
    }),
  ]);

  const offByDay = new Map<string, Set<string>>();
  for (const row of dayOffRows) {
    const key = toDateKeyLocal(row.date);
    if (!offByDay.has(key)) offByDay.set(key, new Set());
    offByDay.get(key)!.add(row.teamMemberId);
  }

  const slotByDay = new Map<string, Map<string, boolean>>();
  for (const row of slotRows) {
    if (!memberIdSet.has(row.teamMemberId)) continue;
    const key = toDateKeyLocal(row.date);
    if (!slotByDay.has(key)) slotByDay.set(key, new Map());
    slotByDay.get(key)!.set(row.teamMemberId, row.available);
  }

  for (let d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
    const key = toDateKeyLocal(d);
    const offSet = offByDay.get(key) ?? new Set<string>();
    const slotMap = slotByDay.get(key) ?? new Map<string, boolean>();
    let n = 0;
    for (const m of members) {
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

/** 팀원 휴무 + 일자별 관리자 수동 가용(ScheduleDayTeamMemberSlot) 병합 후 당일 투입 가능 인원 */
export async function countAvailableFieldStaffOnDate(prisma: PrismaClient, ymd: string): Promise<number> {
  const dateOnly = new Date(`${ymd}T12:00:00+09:00`);
  const [members, overrides] = await Promise.all([
    prisma.teamMember.findMany({
      where: { isActive: true },
      select: {
        id: true,
        dayOffs: { where: { date: dateOnly }, select: { id: true } },
      },
    }),
    prisma.scheduleDayTeamMemberSlot.findMany({
      where: { date: dateOnly },
    }),
  ]);
  const oMap = new Map(overrides.map((o) => [o.teamMemberId, o.available]));
  let n = 0;
  for (const m of members) {
    if (oMap.has(m.id)) {
      if (oMap.get(m.id)) n++;
    } else if (m.dayOffs.length === 0) {
      n++;
    }
  }
  return n;
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
      status: { not: 'CANCELLED' },
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
  preferredDate: Date | null;
  crewMemberCount: number | null;
  excludeInquiryId?: string;
  /** 분배 저장 직전: 이 배열로 타업체 전배 여부 판단(DB 미반영 시) */
  assigneeUserIdsPreview?: string[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { prisma, preferredDate, crewMemberCount, excludeInquiryId, assigneeUserIdsPreview } = params;
  if (!preferredDate) return { ok: true };

  const ymd = ymdKst(preferredDate);
  const activeStaff = await prisma.teamMember.count({ where: { isActive: true } });
  if (activeStaff === 0) return { ok: true };

  const available = await countAvailableFieldStaffOnDate(prisma, ymd);
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
