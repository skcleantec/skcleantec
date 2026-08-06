import type { Prisma, PrismaClient } from '@prisma/client';
import { parseCrewMemberNoteToNames } from './inquiryCrewMemberMeetingTime.service.js';

type Db = PrismaClient | Prisma.TransactionClient;

export type CrewLeaderAssignmentRow = {
  crewMemberName: string;
  teamLeaderId: string;
  sortOrder: number;
};

export function hasCrewMemberLeaderIdsField(body: Record<string, unknown>): boolean {
  return Object.prototype.hasOwnProperty.call(body, 'crewMemberLeaderIds');
}

export function parseCrewMemberLeaderIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x).trim()).filter(Boolean);
}

/** 크루와 함께 나가는(비단독) 팀장 id — 배정 순서 유지 */
export function nonSoloLeaderIds(teamLeaderIds: string[], soloTeamLeaderIds: string[]): string[] {
  const solo = new Set(soloTeamLeaderIds);
  return teamLeaderIds.map((id) => id.trim()).filter((id) => id && !solo.has(id));
}

/** 팀원 슬롯마다 담당 팀장을 고를 UI가 필요한지 */
export function needsExplicitCrewLeaderPick(
  teamLeaderIds: string[],
  soloTeamLeaderIds: string[],
): boolean {
  return nonSoloLeaderIds(teamLeaderIds, soloTeamLeaderIds).length >= 2;
}

/** 복수 비단독 팀장 + 팀원→팀장 매핑이 있으면 팀장별 미팅 시각(Assignment) 사용 */
export function usesPerLeaderCrewMeeting(
  assignments: Array<{ teamLeaderId: string; noCrewMembers: boolean }>,
  leaderAssignments: Array<{ teamLeaderId: string }>,
): boolean {
  const nonSolo = assignments.filter((a) => !a.noCrewMembers);
  return nonSolo.length >= 2 && leaderAssignments.length > 0;
}

export function buildCrewLeaderAssignmentRows(params: {
  crewMemberNote: string | null;
  crewMemberLeaderIds?: string[];
  teamLeaderIds: string[];
  soloTeamLeaderIds: string[];
}): { rows: CrewLeaderAssignmentRow[]; error?: string } {
  const names = parseCrewMemberNoteToNames(params.crewMemberNote);
  if (names.length === 0) return { rows: [] };

  const nonSolo = nonSoloLeaderIds(params.teamLeaderIds, params.soloTeamLeaderIds);
  if (nonSolo.length === 0) {
    return { rows: [], error: '팀원이 있으면 최소 한 명의 팀장은 크루와 함께 나가야 합니다.' };
  }

  const defaultLeader = nonSolo[0]!;
  const explicit = params.crewMemberLeaderIds;
  const nonSoloSet = new Set(nonSolo);
  const rows: CrewLeaderAssignmentRow[] = [];

  for (let i = 0; i < names.length; i++) {
    const name = names[i]!;
    let leaderId = defaultLeader;
    if (explicit && explicit.length > 0) {
      if (explicit.length !== names.length) {
        return {
          rows: [],
          error: '팀원마다 담당 팀장을 지정해 주세요.',
        };
      }
      leaderId = explicit[i]!.trim();
      if (!leaderId || !nonSoloSet.has(leaderId)) {
        return {
          rows: [],
          error: '팀원 담당 팀장은 크루와 함께 나가는 팀장 중에서만 선택할 수 있습니다.',
        };
      }
    } else if (needsExplicitCrewLeaderPick(params.teamLeaderIds, params.soloTeamLeaderIds)) {
      return {
        rows: [],
        error: '팀장이 여러 명일 때는 팀원마다 담당 팀장을 지정해 주세요.',
      };
    }
    rows.push({ crewMemberName: name, teamLeaderId: leaderId, sortOrder: i });
  }

  return { rows };
}

export async function syncInquiryCrewLeaderAssignments(
  db: Db,
  tenantId: string,
  inquiryId: string,
  params: {
    crewMemberNote: string | null;
    crewMemberLeaderIds?: string[];
    teamLeaderIds: string[];
    soloTeamLeaderIds: string[];
  },
): Promise<{ error?: string }> {
  const names = parseCrewMemberNoteToNames(params.crewMemberNote);
  let leaderIds = params.crewMemberLeaderIds;
  if ((!leaderIds || leaderIds.length === 0) && names.length > 0) {
    const existing = await db.inquiryCrewLeaderAssignment.findMany({
      where: { tenantId, inquiryId },
      orderBy: { sortOrder: 'asc' },
      select: { crewMemberName: true, teamLeaderId: true },
    });
    if (existing.length > 0) {
      const nonSolo = nonSoloLeaderIds(params.teamLeaderIds, params.soloTeamLeaderIds);
      const fallback = nonSolo[0] ?? '';
      const byName = new Map(existing.map((r) => [r.crewMemberName, r.teamLeaderId] as const));
      leaderIds = names.map((name) => byName.get(name) ?? fallback).filter(Boolean);
    }
  }

  const built = buildCrewLeaderAssignmentRows({
    ...params,
    crewMemberLeaderIds: leaderIds,
  });
  if (built.error) return { error: built.error };

  await db.inquiryCrewLeaderAssignment.deleteMany({ where: { tenantId, inquiryId } });
  if (built.rows.length === 0) return {};

  await db.inquiryCrewLeaderAssignment.createMany({
    data: built.rows.map((r) => ({
      tenantId,
      inquiryId,
      teamLeaderId: r.teamLeaderId,
      crewMemberName: r.crewMemberName,
      sortOrder: r.sortOrder,
    })),
  });
  return {};
}

export async function clearAssignmentCrewMeetingTimes(
  db: Db,
  tenantId: string,
  inquiryId: string,
): Promise<void> {
  await db.assignment.updateMany({
    where: { tenantId, inquiryId },
    data: { crewMeetingTime: null, crewMeetingTimeUpdatedAt: null },
  });
}

export function filterCrewNamesForLeader(
  names: string[],
  leaderId: string | undefined,
  leaderAssignments: Array<{ crewMemberName: string; teamLeaderId: string }>,
): string[] {
  if (!leaderId || leaderAssignments.length === 0) return names;
  const byName = new Map(leaderAssignments.map((a) => [a.crewMemberName, a.teamLeaderId] as const));
  return names.filter((n) => byName.get(n) === leaderId);
}

export function resolveSharedCrewMeetingForLeader(
  inquiry: {
    crewMeetingTime?: string | null;
    crewMeetingTimeShared?: boolean;
    assignments?: Array<{
      teamLeaderId: string;
      noCrewMembers: boolean;
      crewMeetingTime?: string | null;
    }>;
  },
  leaderAssignments: Array<{ teamLeaderId: string }>,
  viewerTeamLeaderId: string | undefined,
): string | null {
  const assignments = inquiry.assignments ?? [];
  if (
    usesPerLeaderCrewMeeting(assignments, leaderAssignments) &&
    viewerTeamLeaderId
  ) {
    const row = assignments.find((a) => a.teamLeaderId === viewerTeamLeaderId);
    return row?.crewMeetingTime ?? null;
  }
  if (inquiry.crewMeetingTimeShared === false) return null;
  return inquiry.crewMeetingTime ?? null;
}

export function resolveCrewMeetingEditedForLeader(
  inquiry: {
    crewMeetingTimeUpdatedAt: Date | null;
    assignments?: Array<{
      teamLeaderId: string;
      noCrewMembers: boolean;
      crewMeetingTimeUpdatedAt?: Date | null;
    }>;
  },
  leaderAssignments: Array<{ teamLeaderId: string }>,
  viewerTeamLeaderId: string | undefined,
  effectiveMeeting: string | null,
): boolean {
  if (!effectiveMeeting) return false;
  const assignments = inquiry.assignments ?? [];
  if (
    usesPerLeaderCrewMeeting(assignments, leaderAssignments) &&
    viewerTeamLeaderId
  ) {
    const row = assignments.find((a) => a.teamLeaderId === viewerTeamLeaderId);
    return Boolean(row?.crewMeetingTimeUpdatedAt);
  }
  return Boolean(inquiry.crewMeetingTimeUpdatedAt);
}

export async function inquiryHasAnyCrewMeetingTimeExtended(
  db: Db,
  inquiryId: string,
  inquiry: {
    crewMeetingTime: string | null | undefined;
    assignments?: Array<{ crewMeetingTime?: string | null }>;
  },
): Promise<boolean> {
  if ((inquiry.crewMeetingTime ?? '').trim()) return true;
  if (inquiry.assignments?.some((a) => (a.crewMeetingTime ?? '').trim())) return true;
  const n = await db.inquiryCrewMemberMeetingTime.count({ where: { inquiryId } });
  return n > 0;
}
