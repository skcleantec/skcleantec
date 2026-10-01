import type { AiDispatchLeader, AiDispatchProposal } from '../../../api/aiDispatch';
import type { ScheduleItem } from '../../../api/schedule';

/** 승인 전 초안 팀장을 지도 마커에 얹는다. 이미 배정된 일정은 그대로 둔다. */
export function scheduleItemsWithDraftLeaders(
  items: ScheduleItem[],
  proposals: AiDispatchProposal[],
  leaders: AiDispatchLeader[],
): ScheduleItem[] {
  const names = new Map(leaders.map((leader) => [leader.id, leader.name]));
  const draftByInquiry = new Map<string, Array<{ id: string; name: string }>>();
  for (const row of proposals) {
    if (row.status !== 'DRAFT' || !row.teamLeaderId) continue;
    const name = (names.get(row.teamLeaderId) ?? row.teamLeaderName ?? '').trim();
    if (!name) continue;
    const list = draftByInquiry.get(row.inquiryId) ?? [];
    if (!list.some((item) => item.id === row.teamLeaderId)) list.push({ id: row.teamLeaderId, name });
    draftByInquiry.set(row.inquiryId, list);
  }
  return items.map((item) => {
    const hasLeader = (item.assignments ?? []).some((row) => row.teamLeader?.id);
    if (hasLeader) return item;
    const draft = draftByInquiry.get(item.id);
    if (!draft?.length) return item;
    return {
      ...item,
      assignments: [
        {
          teamLeader: {
            id: draft[0].id,
            name: draft.map((leader) => leader.name).join(' · '),
            role: 'TEAM_LEADER',
          },
        },
      ],
    };
  });
}
