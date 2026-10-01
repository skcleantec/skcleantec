import type { AiDispatchLeader, AiDispatchProposal } from '../../../api/aiDispatch';
import type { ScheduleItem } from '../../../api/schedule';

/** 초안 목록과 같은 접수만. 스케줄 API의 취소·보류·대기·타업체·파트너 연계는 빼 둔다. */
export function scheduleItemsMatchingDraft(
  items: ScheduleItem[],
  jobs: ReadonlyArray<{ id: string }>,
  manualJobs: ReadonlyArray<{ id: string }>,
): ScheduleItem[] {
  const ids = new Set<string>();
  for (const job of jobs) ids.add(job.id);
  for (const job of manualJobs) ids.add(job.id);
  return items.filter((item) => ids.has(item.id));
}

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
