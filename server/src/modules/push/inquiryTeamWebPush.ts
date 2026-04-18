/**
 * 팀장 브라우저 Web Push — 모바일에서 탭을 닫으면 신뢰하기 어렵고, 카카오 알림톡 등과도 다름.
 * 배정 알림은 대시보드·스케줄·메시지(WebSocket 폴링)로 확인하도록 하고, 여기서는 전송하지 않는다.
 */
export async function notifyAfterInquiryPatch(_params: {
  inquiryBefore: { assignments: { teamLeaderId: string }[] };
  inquiryAfter: {
    id: string;
    inquiryNumber: string | null;
    customerName: string;
    assignments: { teamLeaderId: string }[];
  };
  lines: string[];
}): Promise<void> {}

export async function notifyNewAssignmentForInquiry(_inquiryId: string, _newTeamLeaderIds: string[]): Promise<void> {}
