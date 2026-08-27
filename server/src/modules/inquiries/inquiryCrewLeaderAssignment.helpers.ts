import type { Prisma, PrismaClient } from '@prisma/client';
import { parseCrewMemberNoteToNames } from './inquiryCrewMemberMeetingTime.service.js';

type Db = PrismaClient | Prisma.TransactionClient;

export class InquiryCrewLeaderSyncError extends Error {
  readonly status = 400 as const;

  constructor(message: string) {
    super(message);
    this.name = 'InquiryCrewLeaderSyncError';
  }
}

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

/** DB에 남은 팀원→팀장 매핑을 현재 teamLeaderIds에 맞게 재매핑 (팀장 교체 시 구 id 제거) */
export function resolveCrewMemberLeaderIdsFromExisting(params: {
  names: string[];
  existing: Array<{ crewMemberName: string; teamLeaderId: string; sortOrder?: number }>;
  teamLeaderIds: string[];
  soloTeamLeaderIds: string[];
}): string[] {
  const nonSolo = nonSoloLeaderIds(params.teamLeaderIds, params.soloTeamLeaderIds);
  const fallback = nonSolo[0] ?? '';
  const nonSoloSet = new Set(nonSolo);
  const existing = [...params.existing].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  const byName = new Map(existing.map((r) => [r.crewMemberName, r.teamLeaderId] as const));
  if (existing.length > 0 && existing.length === params.names.length) {
    return params.names.map((name, i) => {
      const prev = existing[i]?.teamLeaderId;
      if (prev && nonSoloSet.has(prev)) return prev;
      const byKey = byName.get(name);
      if (byKey && nonSoloSet.has(byKey)) return byKey;
      return fallback;
    });
  }
  return params.names
    .map((name) => {
      const prev = byName.get(name);
      if (prev && nonSoloSet.has(prev)) return prev;
      return fallback;
    })
    .filter(Boolean);
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
      select: { crewMemberName: true, teamLeaderId: true, sortOrder: true },
    });
    if (existing.length > 0) {
      leaderIds = resolveCrewMemberLeaderIdsFromExisting({
        names,
        existing,
        teamLeaderIds: params.teamLeaderIds,
        soloTeamLeaderIds: params.soloTeamLeaderIds,
      });
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
  leaderAssignments: Array<{ crewMemberName: string; teamLeaderId: string; sortOrder?: number }>,
): string[] {
  if (!leaderId) return names;
  if (leaderAssignments.length === 0) return names;

  const sorted = [...leaderAssignments].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  if (sorted.length === names.length) {
    return names.filter((_, i) => sorted[i]?.teamLeaderId === leaderId);
  }

  const byName = new Map(sorted.map((a) => [a.crewMemberName, a.teamLeaderId] as const));
  return names.filter((n) => byName.get(n) === leaderId);
}

export function resolveCrewLeaderIdForCrewMember(
  names: string[],
  nameIndex: number,
  leaderAssignments: Array<{ crewMemberName: string; teamLeaderId: string; sortOrder?: number }>,
): string | null {
  if (nameIndex < 0 || nameIndex >= names.length) return null;
  const sorted = [...leaderAssignments].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  if (sorted.length === names.length && sorted[nameIndex]) {
    return sorted[nameIndex]!.teamLeaderId;
  }
  const name = names[nameIndex]!;
  const byName = new Map(sorted.map((a) => [a.crewMemberName, a.teamLeaderId] as const));
  return byName.get(name) ?? null;
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
