import type { Prisma } from '@prisma/client';

export function parseNoCrewMembersInput(raw: unknown): boolean {
  return raw === true || raw === 'true' || raw === 1 || raw === '1';
}

export function hasNoCrewMembersField(body: Record<string, unknown>): boolean {
  return Object.prototype.hasOwnProperty.call(body, 'noCrewMembers');
}

/** PATCH body + 기존 값 → 최종 noCrewMembers 및 crew 필드 정리 */
export function resolveNoCrewMembersForPatch(params: {
  body: Record<string, unknown>;
  inquiryNoCrewMembers: boolean;
  mergedCrewCount: number | null;
  mergedCrewNote: string | null;
  effectiveTeamLeaderCount: number;
}): { noCrewMembers: boolean; error?: string } {
  const { body, inquiryNoCrewMembers, mergedCrewCount, mergedCrewNote, effectiveTeamLeaderCount } = params;

  let next = hasNoCrewMembersField(body) ? parseNoCrewMembersInput(body.noCrewMembers) : inquiryNoCrewMembers;

  const crewNoteTrimmed = String(mergedCrewNote ?? '').trim();
  const hasCrewPayload =
    (mergedCrewCount != null && mergedCrewCount > 0) || crewNoteTrimmed.length > 0;

  if (hasCrewPayload && !(hasNoCrewMembersField(body) && parseNoCrewMembersInput(body.noCrewMembers))) {
    next = false;
  }

  if (next && effectiveTeamLeaderCount < 1) {
    return {
      noCrewMembers: false,
      error: '팀장 단독(크루 없음)은 담당 팀장을 배정한 뒤에만 설정할 수 있습니다.',
    };
  }

  return { noCrewMembers: next };
}

export function applyNoCrewMembersToUpdateData(
  data: Prisma.InquiryUpdateInput,
  noCrewMembers: boolean,
): void {
  data.noCrewMembers = noCrewMembers;
  if (noCrewMembers) {
    data.crewMemberCount = 0;
    data.crewMemberNote = null;
  }
}
