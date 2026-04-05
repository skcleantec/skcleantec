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

/** 해당일 예약(취소 제외) 투입 인원 합 */
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
    select: { crewMemberCount: true },
  });
  return rows.reduce((sum, r) => sum + crewUnitsForInquiry(r.crewMemberCount), 0);
}

export async function assertCrewCapacityForInquiry(params: {
  prisma: PrismaClient;
  preferredDate: Date | null;
  crewMemberCount: number | null;
  excludeInquiryId?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { prisma, preferredDate, crewMemberCount, excludeInquiryId } = params;
  if (!preferredDate) return { ok: true };

  const ymd = ymdKst(preferredDate);
  const activeStaff = await prisma.teamMember.count({ where: { isActive: true } });
  if (activeStaff === 0) return { ok: true };

  const available = await countAvailableFieldStaffOnDate(prisma, ymd);
  const demandExcluding = await sumCrewDemandForPreferredDate(prisma, ymd, excludeInquiryId);
  const thisUnits = crewUnitsForInquiry(crewMemberCount);
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
