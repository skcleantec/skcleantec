/** 접수 편집 — 팀장별 단독(크루 없음) + 접수 공통 팀원 */

export const SOLO_LEADER_CREW_LABEL = '팀장 단독 · 크루 없음';

export function effectiveLeaderIds(
  teamLeaderIds: string[],
  externalTeamLeaderId?: string | null,
): string[] {
  if (externalTeamLeaderId?.trim()) return [externalTeamLeaderId.trim()];
  return teamLeaderIds.map((id) => id.trim()).filter(Boolean);
}

export function hasAssignedTeamLeader(
  teamLeaderIds: string[],
  externalTeamLeaderId?: string | null,
): boolean {
  return effectiveLeaderIds(teamLeaderIds, externalTeamLeaderId).length > 0;
}

export function allTeamLeadersSolo(
  teamLeaderIds: string[],
  soloTeamLeaderIds: string[],
  externalTeamLeaderId?: string | null,
): boolean {
  const ids = effectiveLeaderIds(teamLeaderIds, externalTeamLeaderId);
  if (ids.length === 0) return false;
  const solo = new Set(soloTeamLeaderIds);
  return ids.every((id) => solo.has(id));
}

export function initSoloTeamLeaderIdsFromAssignments(
  assignments: Array<{ teamLeader: { id: string }; noCrewMembers?: boolean | null }> | undefined,
): string[] {
  if (!assignments?.length) return [];
  return assignments.filter((a) => a.noCrewMembers).map((a) => a.teamLeader.id);
}

export function toggleSoloTeamLeaderId(ids: string[], leaderId: string, solo: boolean): string[] {
  const set = new Set(ids);
  if (solo) set.add(leaderId);
  else set.delete(leaderId);
  return [...set];
}

export function applyCrewFieldsToInquiryPatch(
  patch: Record<string, unknown>,
  form: {
    teamLeaderIds: string[];
    soloTeamLeaderIds: string[];
    crewMemberCount: number;
    crewMemberNames: string[];
    externalTeamLeaderId?: string | null;
  },
): void {
  const leaderIds = effectiveLeaderIds(form.teamLeaderIds, form.externalTeamLeaderId);
  patch.soloTeamLeaderIds = form.soloTeamLeaderIds.filter((id) => leaderIds.includes(id));

  if (allTeamLeadersSolo(form.teamLeaderIds, form.soloTeamLeaderIds, form.externalTeamLeaderId)) {
    patch.crewMemberCount = 0;
    patch.crewMemberNote = null;
    return;
  }

  const c = form.crewMemberCount;
  if (!Number.isFinite(c) || c < 0 || c > 100) {
    throw new Error('팀원 인원은 0~100 사이로 설정해주세요.');
  }
  patch.crewMemberCount = Math.floor(c);
  const pickedNames = form.crewMemberNames.map((n) => n.trim()).filter(Boolean);
  patch.crewMemberNote = pickedNames.length > 0 ? pickedNames.join('/') : null;
}

export function adminCrewPreviewLabel(
  item: {
    assignments?: Array<{ noCrewMembers?: boolean | null }>;
    crewMemberCount?: number | null;
    crewMemberNote?: string | null;
  },
  parseNames: (note: string | null | undefined) => string[],
): string {
  const allSolo =
    (item.assignments?.length ?? 0) > 0 &&
    item.assignments!.every((a) => a.noCrewMembers);
  if (allSolo) return SOLO_LEADER_CREW_LABEL;
  const n = item.crewMemberCount ?? 0;
  const raw = (item.crewMemberNote ?? '').trim();
  if (!raw && n <= 0) return '팀원 미입력';
  const names = parseNames(raw).filter(Boolean);
  if (names.length > 0) return `${n}명 · ${names.join('/')}`;
  return `${n}명`;
}

export function viewerAssignmentIsSolo(
  assignments: Array<{ teamLeader: { id: string }; noCrewMembers?: boolean | null }> | undefined,
  viewerId: string | null | undefined,
): boolean {
  if (!viewerId || !assignments?.length) return false;
  return assignments.some((a) => a.teamLeader.id === viewerId && a.noCrewMembers);
}
