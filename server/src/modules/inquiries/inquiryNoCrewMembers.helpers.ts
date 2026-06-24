import type { Prisma } from '@prisma/client';

export function parseNoCrewMembersInput(raw: unknown): boolean {
  return raw === true || raw === 'true' || raw === 1 || raw === '1';
}

/** @deprecated 접수 단위 — Assignment.noCrewMembers 로 대체됨. 레거시 PATCH 호환용 */
export function hasNoCrewMembersField(body: Record<string, unknown>): boolean {
  return Object.prototype.hasOwnProperty.call(body, 'noCrewMembers');
}

export function hasSoloTeamLeaderIdsField(body: Record<string, unknown>): boolean {
  return Object.prototype.hasOwnProperty.call(body, 'soloTeamLeaderIds');
}

export function parseSoloTeamLeaderIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x).trim()).filter(Boolean);
}

export function allTeamLeadersSolo(teamLeaderIds: string[], soloTeamLeaderIds: string[]): boolean {
  if (teamLeaderIds.length === 0) return false;
  const solo = new Set(soloTeamLeaderIds);
  return teamLeaderIds.every((id) => solo.has(id));
}

/** PATCH — 최종 soloTeamLeaderIds 및 검증 */
export function resolveSoloTeamLeaderIdsForPatch(params: {
  body: Record<string, unknown>;
  teamLeaderIds: string[];
  currentAssignments: Array<{ teamLeaderId: string; noCrewMembers: boolean }>;
  wantsTeamSync: boolean;
  mergedCrewCount: number | null;
  mergedCrewNote: string | null;
}): { soloTeamLeaderIds: string[]; error?: string } {
  const { body, teamLeaderIds, currentAssignments, wantsTeamSync, mergedCrewCount, mergedCrewNote } =
    params;

  const leaderSet = new Set(teamLeaderIds);
  let solo: string[];

  if (hasSoloTeamLeaderIdsField(body)) {
    solo = parseSoloTeamLeaderIds(body.soloTeamLeaderIds).filter((id) => leaderSet.has(id));
  } else if (hasNoCrewMembersField(body) && parseNoCrewMembersInput(body.noCrewMembers)) {
    solo = [...teamLeaderIds];
  } else if (wantsTeamSync) {
    solo = currentAssignments
      .filter((a) => a.noCrewMembers && leaderSet.has(a.teamLeaderId))
      .map((a) => a.teamLeaderId);
  } else {
    solo = currentAssignments.filter((a) => a.noCrewMembers).map((a) => a.teamLeaderId);
  }

  if (solo.length > 0 && teamLeaderIds.length < 1) {
    return {
      soloTeamLeaderIds: [],
      error: '팀장 단독(크루 없음)은 담당 팀장을 배정한 뒤에만 설정할 수 있습니다.',
    };
  }

  const crewNoteTrimmed = String(mergedCrewNote ?? '').trim();
  const hasCrewPayload =
    (mergedCrewCount != null && mergedCrewCount > 0) || crewNoteTrimmed.length > 0;

  if (hasCrewPayload && allTeamLeadersSolo(teamLeaderIds, solo)) {
    return {
      soloTeamLeaderIds: solo,
      error: '팀원이 배정된 경우 최소 한 명의 팀장은 크루와 함께 나가야 합니다.',
    };
  }

  return { soloTeamLeaderIds: solo };
}

/** 전 팀장 단독일 때만 접수 팀원 필드 비움 */
export function applyAllSoloCrewClearToUpdateData(
  data: Prisma.InquiryUpdateInput,
  teamLeaderIds: string[],
  soloTeamLeaderIds: string[],
): void {
  if (allTeamLeadersSolo(teamLeaderIds, soloTeamLeaderIds)) {
    data.crewMemberCount = 0;
    data.crewMemberNote = null;
  }
}

export function buildSoloLeaderChangeLines(params: {
  beforeAssignments: Array<{
    teamLeaderId: string;
    noCrewMembers: boolean;
    teamLeader: { name: string; role: string; externalCompany: { name: string } | null };
  }>;
  teamLeaderIds: string[];
  soloTeamLeaderIds: string[];
  assigneeNameById: Map<string, string>;
}): string[] {
  const { beforeAssignments, teamLeaderIds, soloTeamLeaderIds, assigneeNameById } = params;
  const beforeSolo = new Set(
    beforeAssignments.filter((a) => a.noCrewMembers).map((a) => a.teamLeaderId),
  );
  const afterSolo = new Set(soloTeamLeaderIds);
  const lines: string[] = [];
  const ids = new Set([...teamLeaderIds, ...beforeAssignments.map((a) => a.teamLeaderId)]);
  for (const id of ids) {
    const was = beforeSolo.has(id);
    const now = afterSolo.has(id);
    if (was === now) continue;
    const name = assigneeNameById.get(id) ?? id;
    lines.push(`팀장 단독(크루 없음) · ${name}: ${now ? '예' : '아니오'}`);
  }
  return lines;
}

export function soloFlagsChanged(
  before: Array<{ teamLeaderId: string; noCrewMembers: boolean }>,
  teamLeaderIds: string[],
  soloTeamLeaderIds: string[],
): boolean {
  const beforeMap = new Map(before.map((a) => [a.teamLeaderId, a.noCrewMembers] as const));
  const afterSolo = new Set(soloTeamLeaderIds);
  for (const id of teamLeaderIds) {
    const was = beforeMap.get(id) ?? false;
    if (was !== afterSolo.has(id)) return true;
  }
  return false;
}
