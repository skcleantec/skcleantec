import type { Prisma, PrismaClient } from '@prisma/client';
import { tenantActiveTeamMemberWhere } from './crewMemberCapacity.helpers.js';

type Db = PrismaClient | Prisma.TransactionClient;

export function parseCrewMemberNoteToNames(note: string | null | undefined): string[] {
  if (!note) return [];
  return note
    .split(/[,·/|]/g)
    .map((x) => x.trim())
    .filter(Boolean);
}

/** note 순서 유지, 이름당 첫 TeamMember id (동명이인은 sortOrder·createdAt 우선) */
export async function resolveCrewTeamMemberIdsFromNote(
  db: Db,
  tenantId: string,
  note: string | null | undefined,
): Promise<Array<{ teamMemberId: string; name: string }>> {
  const names = parseCrewMemberNoteToNames(note);
  if (!names.length) return [];
  const uniqueNames = [...new Set(names)];
  const members = await db.teamMember.findMany({
    where: {
      name: { in: uniqueNames },
      ...tenantActiveTeamMemberWhere(tenantId),
    },
    select: { id: true, name: true, sortOrder: true, createdAt: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  const idByName = new Map<string, string>();
  for (const m of members) {
    if (!idByName.has(m.name)) idByName.set(m.name, m.id);
  }
  const out: Array<{ teamMemberId: string; name: string }> = [];
  const seen = new Set<string>();
  for (const name of names) {
    const teamMemberId = idByName.get(name);
    if (!teamMemberId || seen.has(teamMemberId)) continue;
    seen.add(teamMemberId);
    out.push({ teamMemberId, name });
  }
  return out;
}

export async function clearInquiryCrewMemberMeetingTimes(
  db: Db,
  inquiryId: string,
): Promise<void> {
  await db.inquiryCrewMemberMeetingTime.deleteMany({ where: { inquiryId } });
}

/** 투입 팀원 note 변경 시 — 허용 id 외 개별 미팅 행 삭제 */
export async function syncMemberMeetingTimesOnRosterChange(
  db: Db,
  inquiryId: string,
  tenantId: string,
  newNote: string | null | undefined,
): Promise<number> {
  const allowed = await resolveCrewTeamMemberIdsFromNote(db, tenantId, newNote);
  const allowedIds = allowed.map((x) => x.teamMemberId);
  if (allowedIds.length === 0) {
    const r = await db.inquiryCrewMemberMeetingTime.deleteMany({ where: { inquiryId } });
    return r.count;
  }
  const r = await db.inquiryCrewMemberMeetingTime.deleteMany({
    where: { inquiryId, teamMemberId: { notIn: allowedIds } },
  });
  return r.count;
}

export type MemberMeetingTimeRow = { teamMemberId: string; meetingTime: string };

export function resolveMemberMeetingTimeRaw(
  shared: boolean,
  sharedTime: string | null,
  memberId: string,
  memberTimes: MemberMeetingTimeRow[],
): string | null {
  if (shared) return sharedTime;
  const row = memberTimes.find((x) => x.teamMemberId === memberId);
  return row?.meetingTime ?? null;
}

export async function upsertInquiryMemberMeetingTimes(
  db: Db,
  tenantId: string,
  inquiryId: string,
  rows: MemberMeetingTimeRow[],
): Promise<void> {
  const allowedIds = rows.map((r) => r.teamMemberId);
  await db.inquiryCrewMemberMeetingTime.deleteMany({
    where: {
      inquiryId,
      ...(allowedIds.length > 0 ? { teamMemberId: { notIn: allowedIds } } : {}),
    },
  });
  if (allowedIds.length === 0) {
    await db.inquiryCrewMemberMeetingTime.deleteMany({ where: { inquiryId } });
    return;
  }
  for (const row of rows) {
    await db.inquiryCrewMemberMeetingTime.upsert({
      where: {
        inquiryId_teamMemberId: { inquiryId, teamMemberId: row.teamMemberId },
      },
      create: {
        tenantId,
        inquiryId,
        teamMemberId: row.teamMemberId,
        meetingTime: row.meetingTime,
      },
      update: { meetingTime: row.meetingTime },
    });
  }
}

export async function inquiryHasAnyCrewMeetingTime(
  db: Db,
  inquiryId: string,
  sharedTime: string | null | undefined,
): Promise<boolean> {
  if ((sharedTime ?? '').trim()) return true;
  const n = await db.inquiryCrewMemberMeetingTime.count({ where: { inquiryId } });
  return n > 0;
}
