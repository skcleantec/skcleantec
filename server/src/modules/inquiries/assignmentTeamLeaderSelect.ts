/** 스케줄·접수 응답에서 배정 담당자(팀장·타업체) 표시용 */
export const assignmentTeamLeaderSelect = {
  id: true,
  name: true,
  role: true,
  externalCompany: { select: { id: true, name: true } },
} as const;
