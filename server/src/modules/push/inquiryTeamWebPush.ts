import { notifyInboxRefresh } from '../realtime/inboxNotify.js';

/**
 * 접수 PATCH 후 푸시 등 — Web Push는 사용하지 않음. (실시간은 `notifyInboxRefresh` / WS)
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

/**
 * 팀장 배정·재배정 직후: 해당 팀장(및 직전 담당)에게 WS `inbox:refresh` 전송.
 * 클라이언트 `useInboxRealtime` 이 배지·배정목록·대시보드·스케줄 등을 다시 불러오게 한다.
 */
export async function notifyNewAssignmentForInquiry(
  _inquiryId: string,
  newTeamLeaderIds: string[],
  previousTeamLeaderIds: string[] = []
): Promise<void> {
  const ids = new Set<string>();
  for (const id of newTeamLeaderIds) {
    if (id) ids.add(id);
  }
  for (const id of previousTeamLeaderIds) {
    if (id) ids.add(id);
  }
  if (ids.size === 0) return;
  notifyInboxRefresh([...ids]);
}
