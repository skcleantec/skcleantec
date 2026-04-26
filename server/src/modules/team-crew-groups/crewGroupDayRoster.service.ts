import { prisma } from '../../lib/prisma.js';

export const ROSTER_YMD = /^\d{4}-\d{2}-\d{2}$/;

export function parseYmdToDate(ymd: string): Date {
  return new Date(`${ymd}T12:00:00`);
}

/** 그룹에 속한 teamMemberId 집합 */
export async function getGroupTeamMemberIdSet(groupId: string): Promise<Set<string>> {
  const rows = await prisma.teamCrewGroupMember.findMany({
    where: { groupId },
    select: { teamMemberId: true },
  });
  return new Set(rows.map((r) => r.teamMemberId));
}

export function assertSubsetOrThrow(teamMemberIds: string[], allowed: Set<string>): void {
  for (const id of teamMemberIds) {
    if (!allowed.has(id)) {
      throw new Error(`CREW_ROSTER_INVALID_MEMBER:${id}`);
    }
  }
}

export type DayRosterEntryOut = { date: string; teamMemberIds: string[] };

export async function getDayRosterInRange(
  groupId: string,
  startYmd: string,
  endYmd: string
): Promise<DayRosterEntryOut[]> {
  const start = parseYmdToDate(startYmd);
  const end = parseYmdToDate(endYmd);
  const rows = await prisma.teamCrewGroupDayRoster.findMany({
    where: { groupId, date: { gte: start, lte: end } },
    orderBy: [{ date: 'asc' }, { teamMemberId: 'asc' }],
    select: { date: true, teamMemberId: true },
  });
  const byDate = new Map<string, string[]>();
  for (const r of rows) {
    const k = r.date.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
    const arr = byDate.get(k) ?? [];
    arr.push(r.teamMemberId);
    byDate.set(k, arr);
  }
  return [...byDate.entries()].map(([date, teamMemberIds]) => ({ date, teamMemberIds }));
}

/** 날짜별 명단 일괄 저장(각 날짜는 전체 교체) */
export async function putDayRosterEntries(
  groupId: string,
  entries: { date: string; teamMemberIds: string[] }[]
): Promise<void> {
  const allowed = await getGroupTeamMemberIdSet(groupId);
  for (const e of entries) {
    if (!ROSTER_YMD.test(e.date)) {
      throw new Error('CREW_ROSTER_BAD_DATE');
    }
    assertSubsetOrThrow(e.teamMemberIds, allowed);
  }
  await prisma.$transaction(async (tx) => {
    for (const e of entries) {
      const d = parseYmdToDate(e.date);
      await tx.teamCrewGroupDayRoster.deleteMany({ where: { groupId, date: d } });
      if (e.teamMemberIds.length > 0) {
        await tx.teamCrewGroupDayRoster.createMany({
          data: e.teamMemberIds.map((teamMemberId) => ({ groupId, date: d, teamMemberId })),
        });
      }
    }
  });
}
