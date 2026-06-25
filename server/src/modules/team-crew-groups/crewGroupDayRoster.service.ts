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

export type DayRosterMemberOut = { teamMemberId: string; isStandby: boolean };

export type DayRosterEntryOut = {
  date: string;
  members: DayRosterMemberOut[];
  /** 일할 멤버 id — 달력·용량 등 하위 호환 */
  teamMemberIds: string[];
  /** 현장 일정 「대기」 표시 대상 */
  standbyTeamMemberIds: string[];
};

export type DayRosterEntryIn = {
  date: string;
  members?: DayRosterMemberOut[];
  /** 레거시 — isStandby는 모두 false */
  teamMemberIds?: string[];
};

export function normalizeDayRosterEntry(entry: DayRosterEntryIn): {
  date: string;
  members: DayRosterMemberOut[];
} {
  if (Array.isArray(entry.members)) {
    const seen = new Set<string>();
    const members: DayRosterMemberOut[] = [];
    for (const m of entry.members) {
      if (!m || typeof m.teamMemberId !== 'string') continue;
      const id = m.teamMemberId.trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      members.push({ teamMemberId: id, isStandby: Boolean(m.isStandby) });
    }
    return { date: entry.date, members };
  }
  const ids = Array.isArray(entry.teamMemberIds) ? entry.teamMemberIds : [];
  const seen = new Set<string>();
  const members: DayRosterMemberOut[] = [];
  for (const raw of ids) {
    if (typeof raw !== 'string') continue;
    const id = raw.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    members.push({ teamMemberId: id, isStandby: false });
  }
  return { date: entry.date, members };
}

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
    select: { date: true, teamMemberId: true, isStandby: true },
  });
  const byDate = new Map<string, DayRosterMemberOut[]>();
  for (const r of rows) {
    const k = r.date.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
    const arr = byDate.get(k) ?? [];
    arr.push({ teamMemberId: r.teamMemberId, isStandby: r.isStandby });
    byDate.set(k, arr);
  }
  return [...byDate.entries()].map(([date, members]) => ({
    date,
    members,
    teamMemberIds: members.map((m) => m.teamMemberId),
    standbyTeamMemberIds: members.filter((m) => m.isStandby).map((m) => m.teamMemberId),
  }));
}

/** 날짜별 명단 일괄 저장(각 날짜는 전체 교체) */
export async function putDayRosterEntries(
  groupId: string,
  entries: DayRosterEntryIn[]
): Promise<void> {
  const allowed = await getGroupTeamMemberIdSet(groupId);
  const normalized = entries.map(normalizeDayRosterEntry);
  for (const e of normalized) {
    if (!ROSTER_YMD.test(e.date)) {
      throw new Error('CREW_ROSTER_BAD_DATE');
    }
    assertSubsetOrThrow(
      e.members.map((m) => m.teamMemberId),
      allowed
    );
  }
  await prisma.$transaction(async (tx) => {
    for (const e of normalized) {
      const d = parseYmdToDate(e.date);
      await tx.teamCrewGroupDayRoster.deleteMany({ where: { groupId, date: d } });
      if (e.members.length > 0) {
        await tx.teamCrewGroupDayRoster.createMany({
          data: e.members.map((m) => ({
            groupId,
            date: d,
            teamMemberId: m.teamMemberId,
            isStandby: m.isStandby,
          })),
        });
      }
    }
  });
}
