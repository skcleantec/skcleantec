/** 접수 편집 — 팀장 단독(크루 없음) 공통 */

export function hasAssignedTeamLeader(
  teamLeaderIds: string[],
  externalTeamLeaderId?: string | null,
): boolean {
  if (externalTeamLeaderId?.trim()) return true;
  return teamLeaderIds.some((id) => id.trim() !== '');
}

export function applyCrewFieldsToInquiryPatch(
  patch: Record<string, unknown>,
  form: {
    noCrewMembers: boolean;
    crewMemberCount: number;
    crewMemberNames: string[];
  },
): void {
  patch.noCrewMembers = form.noCrewMembers;
  if (form.noCrewMembers) {
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

export const SOLO_LEADER_CREW_LABEL = '팀장 단독 · 크루 없음';

export function adminCrewPreviewLabel(
  item: {
    noCrewMembers?: boolean | null;
    crewMemberCount?: number | null;
    crewMemberNote?: string | null;
  },
  parseNames: (note: string | null | undefined) => string[],
): string {
  if (item.noCrewMembers) return SOLO_LEADER_CREW_LABEL;
  const n = item.crewMemberCount ?? 0;
  const raw = (item.crewMemberNote ?? '').trim();
  if (!raw && n <= 0) return '팀원 미입력';
  const names = parseNames(raw).filter(Boolean);
  if (names.length > 0) return `${n}명 · ${names.join('/')}`;
  return `${n}명`;
}
